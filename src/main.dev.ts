import 'core-js/stable';
import { app, BrowserWindow, dialog, shell } from 'electron';
import log from 'electron-log';
import path from 'path';
import 'regenerator-runtime/runtime';
import {
  SettingsListType,
  defaultSettings,
  animeEntryInfoType,
  AnimeInfoListType,
  AnimeEntryInfoMetadataType,
  animeEntryInfoVideoSectionType,
  animeEntryInfoVideoType,
} from './types';

const fs = require('fs');
const { ipcMain } = require('electron');
const glob = require('glob');
const musicMetadata = require('music-metadata');
const cueParser = require('cue-parser');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const Promise = require('bluebird');
const md5 = require('js-md5');
const ProgressBar = require('electron-progressbar');

const ffprobe = Promise.promisify(ffmpeg.ffprobe);
const animeEntryPath = path.join(app.getPath('userData'), 'Animes');
const snapshotCachePath = path.join(app.getPath('userData'), 'Snapshot Cache');

/*****************************************************************************
 ****************************  settings checker  *****************************
 *****************************************************************************/

export class settingChecker {
  constructor() {
    // check if folders exist
    if (!fs.existsSync(animeEntryPath)) {
      fs.mkdirSync(animeEntryPath);
    }

    if (!fs.existsSync(snapshotCachePath)) {
      fs.mkdirSync(snapshotCachePath);
    }

    // take care of ffmpeg path
    let ffmpegPath = require('ffmpeg-static-electron').path;
    let ffprobePath = require('ffprobe-static-electron').path;
    if (process.env.NODE_ENV === 'production') {
      const sep = process.platform === 'win32' ? '\\' : '/';
      ffmpegPath = ffmpegPath.replace('app.asar', 'node_modules' + sep + 'ffmpeg-static-electron');
      ffprobePath = ffprobePath.replace('app.asar', 'node_modules' + sep + 'ffprobe-static-electron');
    }
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
  }
}

/*****************************************************************************
 ********************************  utilities  ********************************
 *****************************************************************************/

// TODO: use ISO 639-2 converter
const languages: { [short: string]: string } = {
  chi: 'Chinese',
  eng: 'English',
  jpn: 'Japanese',
  rus: 'Russian',
};

function writeJsonToFile(json: any, path: string) {
  const data = JSON.stringify(json, null, 4);
  fs.writeFile(path, data, (err: Error) => {
    if (err) throw err;
    console.log('written to ', path);
  });
}

function deleteFile(path: string) {
  fs.unlink(path, (err: Error) => {
    if (err) throw err;
    console.log('delete file ', path);
  });
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = Math.round(totalSeconds % 60);

  return (hours === 0 ? '' : hours + ':') + minutes + ':' + (seconds > 9 ? seconds : '0' + seconds);
}

function formatSampleRate(sampleRate: number): string {
  const MHzValue = Math.floor(sampleRate / 10000000);
  if (MHzValue > 0) {
    return MHzValue + 'MHz';
  }
  const kHzValue = Math.floor(sampleRate / 1000);
  if (kHzValue > 0) {
    return kHzValue + 'kHz';
  }

  return sampleRate + 'Hz';
}

function promisifyCommand(command: any, run = 'run') {
  return Promise.promisify((...args: any[]) => {
    const cb = args.pop();
    command
      .on('end', () => {
        cb(null);
      })
      .on('error', (error: Error) => {
        cb(error);
      })
      [run](...args);
  });
}

async function fetchBangumiAPI(bangumiID: string): Promise<any> {
  try {
    const response = await fetch('https://api.bgm.tv/subject/' + bangumiID + '?responseGroup=large', {
      headers: {
        'content-type': 'application/json',
      },
      method: 'GET',
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    log.error(err);
    return undefined;
  }
  return undefined;
}

async function searchBangumiAPI(name: string): Promise<any> {
  try {
    const response = await fetch(
      'https://api.bgm.tv/search/subject/' + encodeURIComponent(name) + '?type=2&responseGroup=small',
      {
        headers: {
          'content-type': 'application/json',
        },
        method: 'GET',
      }
    );

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    log.error(err);
    return undefined;
  }
  return undefined;
}

/*****************************************************************************
 ****************************  electron settings  ****************************
 *****************************************************************************/

class Settings {
  settingsPath: string;
  settingsData: SettingsListType;
  settingsModified: boolean;

  constructor(options: { configName: string; defaults: SettingsListType }) {
    this.settingsModified = false;
    this.settingsPath = path.join(app.getPath('userData'), options.configName + '.json');
    try {
      this.settingsData = JSON.parse(fs.readFileSync(this.settingsPath));
    } catch (err) {
      this.settingsData = options.defaults;
      (this.settingsData.backgroundValue = app.isPackaged
        ? path.join(process.resourcesPath, 'assets/background.jpg')
        : path.join(__dirname, '../assets/background.jpg')),
        (this.settingsModified = true);
    }
  }

  updateSettings(newSettings: SettingsListType) {
    newSettings.windowWidth = this.settingsData.windowWidth;
    newSettings.windowHeight = this.settingsData.windowHeight;
    this.settingsData = newSettings;
    this.settingsModified = true;
  }

  getSettings(): SettingsListType {
    return this.settingsData;
  }

  setWindowSize(width: number, height: number) {
    this.settingsModified = true;
    this.settingsData.windowWidth = width;
    this.settingsData.windowHeight = height;
  }

  getBackgroundCSS(): string {
    let backgroundCSS: string = '';
    switch (this.settingsData.backgroundType) {
      case 'color':
        backgroundCSS = this.settingsData.backgroundValue;
        break;
      case 'image':
        backgroundCSS = "url('" + this.settingsData.backgroundValue + "')";
        break;
      case 'folder': // randomly choose an image from a folder
        const imageExt = ['.jpg', '.png', '.jfif', '.webp'];
        const result = glob.sync('/**/*', {
          nobrace: true,
          root: this.settingsData.backgroundValue,
        });

        let imageFiles: Array<string> = [];

        result.forEach((filePath: string) => {
          if (imageExt.includes(path.extname(filePath))) {
            imageFiles.push(filePath);
          }
        });

        backgroundCSS = "url('" + imageFiles[Math.floor(Math.random() * imageFiles.length)] + "')";
        break;
    }

    if (process.platform === 'win32') {
      backgroundCSS = backgroundCSS.replace('\\', '//').replaceAll('\\', '/');
    }
    return backgroundCSS;
  }

  getThemeColor(): string {
    return this.settingsData.themeColor === '' ? 'pink' : this.settingsData.themeColor;
  }

  save() {
    if (this.settingsModified) {
      writeJsonToFile(this.settingsData, this.settingsPath);
    }
  }
}

let settings = new Settings({
  configName: 'user-preferences',
  defaults: defaultSettings,
});

ipcMain.handle(
  'getSettings',
  (_event: Electron.IpcMainEvent): SettingsListType => {
    return settings.getSettings();
  }
);

// ipc getBackgroundCSS
ipcMain.handle('getBackgroundImage', (_event: Electron.IpcMainEvent): string => {
  return settings.getBackgroundCSS();
});

ipcMain.on('updateSettings', (event: Electron.IpcMainEvent, newSettings: SettingsListType) => {
  const backgroundShouldUpdate =
    newSettings.backgroundType !== settings.getSettings().backgroundType ||
    newSettings.backgroundValue !== settings.getSettings().backgroundValue;
  settings.updateSettings(newSettings);
  event.reply('updateSettings', settings.getSettings());
  if (backgroundShouldUpdate) event.reply('updateBackground', settings.getBackgroundCSS());
});

/*****************************************************************************
 *****************************  anime info list  *****************************
 *****************************************************************************/

class AnimeInfoList {
  animeInfoListPath: string;
  animeInfoListData: AnimeInfoListType;

  constructor() {
    this.animeInfoListPath = path.join(app.getPath('userData'), 'animeInfo.json');

    try {
      this.animeInfoListData = JSON.parse(fs.readFileSync(this.animeInfoListPath));
    } catch (err) {
      this.animeInfoListData = [];
    }
  }

  existAnime(title: string): boolean {
    for (const entry of this.animeInfoListData) {
      if (entry.title === title) return true;
    }
    return false;
  }

  getAnimePath(title: string): string {
    for (const entry of this.animeInfoListData) {
      if (entry.title === title) return entry.path;
    }
    return 'none';
  }

  getAllAnimePath(): string[] {
    let pathArray: string[] = [];
    for (const entry of this.animeInfoListData) {
      pathArray.push(entry.path);
    }
    return pathArray;
  }

  getAllAnimeTitle(): string[] {
    let titleArray: string[] = [];
    for (const entry of this.animeInfoListData) {
      titleArray.push(entry.title);
    }
    return titleArray;
  }

  add(title: string, path: string) {
    this.animeInfoListData.push({ title: title, path: path });
  }

  delete(title: string) {
    for (let idx = 0; idx < this.animeInfoListData.length; ++idx) {
      if (this.animeInfoListData[idx].title === title) {
        this.animeInfoListData.splice(idx, 1);
        return;
      }
    }
  }

  updateAnimeTitle(oldTitle: string, newTitle: string) {
    for (let entry of this.animeInfoListData) {
      if (entry.title === oldTitle) {
        entry.title = newTitle;
      }
    }
  }

  updateAnimeInfoList(sourceIdx: number, destinationIdx: number) {
    let newAnimeInfoList = this.animeInfoListData;
    const [removed] = newAnimeInfoList.splice(sourceIdx, 1);
    newAnimeInfoList.splice(destinationIdx, 0, removed);
    this.animeInfoListData = newAnimeInfoList;
  }

  sort(mode: 'name' | 'date') {
    if (mode === 'name') {
      this.animeInfoListData.sort(function (a, b) {
        return a.title > b.title ? 1 : -1;
      });
    } else {
      //TODO: sort by date
    }
  }

  save() {
    writeJsonToFile(this.animeInfoListData, this.animeInfoListPath);
  }
}

let animeInfoList = new AnimeInfoList();

/**
 * ipc getAnimeList
 */
ipcMain.handle('getAnimeList', (_event: Electron.IpcMainEvent): string[] => {
  return animeInfoList.getAllAnimeTitle();
});

/**
 * ipc updateAnimeInfoList
 */
ipcMain.on('updateAnimeInfoList', (_event: Electron.IpcMainEvent, sourceIdx: number, destinationIdx: number) => {
  animeInfoList.updateAnimeInfoList(sourceIdx, destinationIdx);
});

/**
 * ipc sortAnimeInfoList
 */
ipcMain.handle('sortAnimeInfoList', (_event: Electron.IpcMainEvent, mode: 'name' | 'date'): string[] => {
  animeInfoList.sort(mode);
  return animeInfoList.getAllAnimeTitle();
});

/**
 * ipc deleteAnimeEntry
 */
ipcMain.on('deleteAnimeEntry', async (event: Electron.IpcMainEvent, title: string, deleteData: boolean = false) => {
  if (!animeInfoList.existAnime(title)) return;

  if (deleteData) {
    deleteFile(path.join(animeEntryPath, title + '.json'));
    currentAnimeEntryInspector.removeAllVideoSnapshots();
  }

  animeInfoList.delete(title);
  event.reply('updateAnimeEntry', animeInfoList.getAllAnimeTitle());
  event.reply('clearEntrySelect');
  event.reply('removeAnimeTab');
});

/**
 * ipc animeEntryClick
 */
ipcMain.on('animeEntryClick', async (event: Electron.IpcMainEvent, title: string) => {
  currentAnimeEntryInspector = new AnimeEntryInspector(title);
  if (currentAnimeEntryInspector.parseFromJson()) {
    event.sender.send('createAnimeDetailTab', currentAnimeEntryInspector.getAnimeEntryInfo());
  } else {
    const inspectResult: 'OK' | 'fail' | 'question' = await currentAnimeEntryInspector.inspect();
    if (inspectResult === 'OK') {
      event.sender.send('createAnimeDetailTab', currentAnimeEntryInspector.getAnimeEntryInfo());
    } else if (inspectResult === 'fail') {
      event.reply('clearEntrySelect');
      event.reply('removeAnimeTab');
      event.reply('showAnimeDeleteQuestionMessage', title);
    } else {
      event.reply('clearEntrySelect');
      event.reply('removeAnimeTab');
      event.reply('showAnimeForceInspectQuestionMessage', title);
    }
  }
});

/**
 * ipc animeEntryForceInspect
 */
ipcMain.on('animeEntryForceInspect', async (event: Electron.IpcMainEvent, title: string) => {
  const inspectResult: 'OK' | 'fail' | 'question' = await currentAnimeEntryInspector.inspect(false, true);
  if (inspectResult === 'OK') {
    event.sender.send('createAnimeDetailTab', currentAnimeEntryInspector.getAnimeEntryInfo());
  } else if (inspectResult === 'fail') {
    event.reply('clearEntrySelect');
    event.reply('removeAnimeTab');
    event.reply('showAnimeDeleteQuestionMessage', title);
  } else {
    // wouldn't return question here, do nothing
  }
});

/**
 * ipc selectAnimeContainingFolder
 */
ipcMain.on('selectAnimeContainingFolder', async (event: Electron.IpcMainEvent) => {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length !== 1) return;

  const pathSet = animeInfoList.getAllAnimePath();

  try {
    const files: any[] = await fs.promises.readdir(result.filePaths[0], {
      withFileTypes: true,
    });

    files.forEach((file) => {
      if (
        file.isDirectory() &&
        file.name !== '$RECYCLE.BIN' &&
        !pathSet.includes(path.join(result.filePaths[0], file.name)) &&
        !animeInfoList.existAnime(file.name)
      ) {
        animeInfoList.add(file.name, path.join(result.filePaths[0], file.name));
      }
    });
  } catch (err) {
    log.error(err);
  }

  event.reply('updateAnimeEntry', animeInfoList.getAllAnimeTitle());
});

/**
 * ipc selectAnimeFolder
 */
ipcMain.on('selectAnimeFolder', async (event: Electron.IpcMainEvent) => {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections'],
  });

  if (result.canceled || result.filePaths.length === 0) return;

  const pathSet = animeInfoList.getAllAnimePath();

  try {
    result.filePaths.forEach((folder) => {
      const folderBasename = path.basename(folder);
      if (
        folderBasename !== '$RECYCLE.BIN' &&
        !pathSet.includes(path.join(result.filePaths[0], folder)) &&
        !animeInfoList.existAnime(folderBasename)
      ) {
        animeInfoList.add(folderBasename, folder);
      }
    });
  } catch (err) {
    console.log(err);
  }

  event.reply('updateAnimeEntry', animeInfoList.getAllAnimeTitle());
});

/*****************************************************************************
 **************************  anime entry inspector  **************************
 *****************************************************************************/

class AnimeEntryInspector {
  animeEntryInfo: animeEntryInfoType;
  animeFiles: string[];
  progressBar: any;

  constructor(title: string) {
    this.animeEntryInfo = {
      title: title,
      path: animeInfoList.getAnimePath(title),
      video: [],
      music: {},
    };

    this.animeFiles = [];
  }

  parseFromJson(): boolean {
    const animeEntry = path.join(animeEntryPath, this.animeEntryInfo.title + '.json');
    try {
      this.animeEntryInfo = JSON.parse(fs.readFileSync(animeEntry));
      return true;
    } catch (err) {
      return false;
    }
  }

  saveToFile() {
    writeJsonToFile(this.animeEntryInfo, path.join(animeEntryPath, this.animeEntryInfo.title + '.json'));
  }

  async inspect(reInspect: boolean = false, forceInspect: boolean = false): Promise<'OK' | 'fail' | 'question'> {
    this.progressBar = new ProgressBar({
      text: 'Inspecting Folder...',
      detail: 'Resolving files in folder',
      browserWindow: { parent: mainWindow },
      style: {
        text: { fontSize: '26px', color: 'white' },
        detail: { fontSize: '20px', lineHeight: '20px', color: 'white', overflow: 'hidden' },
        bar: { background: 'lightgrey' },
        value: { background: settings.getThemeColor() },
      },
    });

    try {
      this.animeFiles = glob.sync('/**/*', {
        nobrace: true,
        root: this.animeEntryInfo.path,
      });
    } catch (err) {
      log.error(err);
      this.progressBar.close();
      this.progressBar = null;
      return 'fail';
    }

    if (this.animeFiles.length === 0) {
      this.progressBar.close();
      this.progressBar = null;
      return 'fail';
    } else if (this.animeFiles.length > 1000 && !forceInspect) {
      this.progressBar.close();
      this.progressBar = null;
      return 'question';
    }

    if (reInspect) {
      this.animeEntryInfo.video = [];
      this.animeEntryInfo.music = {};
    }

    this.progressBar.detail = 'Resolving videos.';
    await this.solveVideoFiles();

    this.progressBar.detail = 'Resolving audios.';
    await this.solveAudioFiles();

    this.progressBar.close();
    this.progressBar = null;

    this.saveToFile();

    return 'OK';
  }

  setMetadata(metadata: AnimeEntryInfoMetadataType) {
    this.animeEntryInfo.metadata = metadata;
    this.saveToFile();
  }

  async getVideoSnapshot(targetFile: string, timestamp: string | null = null) {
    try {
      const frame = timestamp ? [timestamp] : [Math.floor(Math.random() * 100) + '%'];
      const snapshotWidth: number = settings.getSettings().videoSnapshotWidth;

      await promisifyCommand(
        ffmpeg(targetFile),
        'takeScreenshots'
      )({
        timestamps: frame,
        filename: md5.hex(targetFile) + '.jpg',
        folder: snapshotCachePath,
        size: snapshotWidth + 'x?',
      });
    } catch (err) {
      log.error(err);
    }
  }

  async solveVideoFile(
    file: string,
    subtitles: Array<string>,
    mkaPath: string
  ): Promise<animeEntryInfoVideoType | null> {
    let audioTrack: Array<string> = [];
    let resolution: string = '';

    this.progressBar.detail = 'Resolving: ' + file;

    try {
      const resolveAudioTrack = (stream: any, isMka: boolean = false) => {
        let audioTrackInfo = isMka ? 'MKA:' : '';
        // add language
        audioTrackInfo += stream.tags?.language ? '[' + languages[stream.tags.language] + '] ' : '';
        // add language title
        audioTrackInfo += stream.tags.title ? '<' + stream.tags.title + '> ' : '';
        // add name
        audioTrackInfo += stream.codec_name.toUpperCase() + ', ';
        // add channels
        audioTrackInfo += stream.channels + 'ch, ';
        // add sample rate
        audioTrackInfo += formatSampleRate(stream.sample_rate);

        audioTrack.push(audioTrackInfo);
      };

      const metadata: any = await ffprobe(file);

      metadata.streams.forEach((stream: any) => {
        if (stream.codec_type === 'video') {
          resolution = stream.width + 'x' + stream.height;
        } else if (stream.codec_type === 'subtitle' && stream.tags?.language) {
          // include internal subtitle track
          subtitles.push(languages[stream.tags.language] + (stream.tags.title ? '(' + stream.tags.title + ')' : ''));
        } else if (stream.codec_type === 'audio') {
          resolveAudioTrack(stream);
        }
      });

      if (mkaPath !== '') {
        const mkaData: any = await ffprobe(mkaPath);
        mkaData.streams.forEach((stream: any) => {
          if (stream.codec_type === 'audio') {
            resolveAudioTrack(stream, true);
          }
        });
      }

      await this.getVideoSnapshot(file);

      return {
        basename: path.basename(file),
        duration: formatTime(metadata.format.duration),
        size: formatBytes(metadata.format.size),
        resolution: resolution,
        audio: audioTrack,
        subtitles: subtitles,
      };
    } catch (err) {
      log.error(err);
      return null;
    }
  }

  // solve video files
  async solveVideoFiles() {
    const videoExt = ['.mkv', '.mp4', '.flv', '.avi'];
    const subtitleExt = ['.ass', '.ssa', '.srt', '.smi', '.sub'];

    let videoList: {
      [dirname: string]: { video: Array<string>; mka: Array<string>; subtitle: Array<string> };
    } = {};

    this.animeFiles.forEach((file: string) => {
      const ext = path.extname(file);
      if (!videoExt.includes(ext) && !subtitleExt.includes(ext) && ext !== '.mka') return;

      const dirname = path.dirname(path.relative(this.animeEntryInfo.path, file));
      // create if dirname does not exist
      if (!videoList[dirname]) videoList[dirname] = { video: [], mka: [], subtitle: [] };

      if (ext === '.mka') {
        videoList[dirname].mka.push(file);
      } else if (subtitleExt.includes(ext)) {
        videoList[dirname].subtitle.push(file);
      } else if (videoExt.includes(ext)) {
        videoList[dirname].video.push(file);
      }
    });

    for (const dirname in videoList) {
      let solveVideoAwait: Array<Promise<animeEntryInfoVideoType | null>> = [];
      videoList[dirname].video.forEach((file) => {
        const parsed: path.ParsedPath = path.parse(file);
        // check mka
        const mkaPath: string = path.join(parsed.dir, parsed.name + '.mka');
        const existMka: boolean = videoList[dirname].mka.includes(mkaPath);
        // check subtitle
        let subtitles: Array<string> = [];
        videoList[dirname].subtitle.forEach((subtitleFile) => {
          const subtitlePossibleA = subtitleFile.slice(0, subtitleFile.lastIndexOf('.'));
          const subtitlePossibleB = subtitlePossibleA.slice(0, subtitlePossibleA.lastIndexOf('.'));
          if (subtitlePossibleA + path.extname(file) === file) {
            subtitles.push(subtitleFile.slice(subtitleFile.lastIndexOf('.')));
          } else if (subtitlePossibleB + path.extname(file) === file) {
            subtitles.push(subtitleFile.slice(subtitlePossibleB.length));
          }
        });

        solveVideoAwait.push(this.solveVideoFile(file, subtitles, existMka ? mkaPath : ''));
      });

      const videos: Array<animeEntryInfoVideoType | null> = await Promise.all(solveVideoAwait);
      let dirEntry: animeEntryInfoVideoSectionType = {
        dirname: dirname,
        videos: [],
      };
      videos.forEach((video) => {
        if (video) dirEntry.videos.push(video);
      });
      this.animeEntryInfo.video.push(dirEntry);
    }
  }

  // parse cue file and remove related files, fetch cue metadata
  async fetchCueMetadata(file: any, relatedFile: string, album: string) {
    let metadata = await musicMetadata.parseFile(relatedFile);

    interface cueTracksEntryType {
      title: string;
      artist: string;
      track: number;
      index00?: number;
      index01: number;
      duration?: number;
    }

    interface cueTracksType extends Array<cueTracksEntryType> {}

    let cueTracks: cueTracksType = [];

    // resolve track plain info
    file.tracks.forEach((track: any) => {
      let cueTracksEntry: cueTracksEntryType = {
        title: track.title,
        artist: track.performer,
        track: track.number,
        index01: -1,
      };

      track.indexes.forEach((index: any) => {
        const entryKey: keyof cueTracksEntryType = index.number === 0 ? 'index00' : 'index01';
        cueTracksEntry[entryKey] = index.time.min * 60 + index.time.sec * 1 + index.time.frame / 75;
      });

      cueTracks.push(cueTracksEntry);
    });

    // convert track plain info to duration
    cueTracks.sort(function (trackA, trackB) {
      return trackA.track - trackB.track;
    });

    cueTracks.forEach((trackEntry: cueTracksEntryType, index: number) => {
      if (index === cueTracks.length - 1) {
        trackEntry['duration'] = metadata.format.duration - trackEntry.index01;
      } else {
        // if track00 exists, use index00, otherwise use index01
        let nextIndex00 = cueTracks[index + 1]['index00'];
        trackEntry['duration'] = (nextIndex00 ? nextIndex00 : cueTracks[index + 1]['index01']) - trackEntry['index01'];
      }

      this.animeEntryInfo.music[album].push({
        title: trackEntry.title,
        artist: trackEntry.artist,
        track: trackEntry.track,
        duration: Math.round(trackEntry.duration * 100) / 100,
      });
    });
  }

  // parse single file's metadata, parseMetadataFunction
  async fetchMusicMetaData(filePath: string) {
    try {
      let metadata = await musicMetadata.parseFile(filePath);
      // add album
      let singleTitle = metadata.common.title ? metadata.common.title : path.basename(filePath);
      let album = metadata.common.album ? metadata.common.album : 'Untagged';
      if (!this.animeEntryInfo.music[album]) {
        this.animeEntryInfo.music[album] = [];
      }
      this.animeEntryInfo.music[album].push({
        title: singleTitle,
        artist: metadata.common.artist,
        track: metadata.common.track.no,
        duration: metadata.format.duration.toFixed(2),
      });
    } catch (err) {
      console.error(err);
    }
  }

  // solve audio files
  async solveAudioFiles() {
    // get all audio files, split cue and single
    let cueFiles: string[] = [];
    let singleFiles: string[] = [];
    const audioSingleExt = ['.flac', '.ogg', '.wav'];
    this.animeFiles.forEach((audioFile: string) => {
      if (path.extname(audioFile) === '.cue') {
        cueFiles.push(audioFile);
      } else if (audioSingleExt.includes(path.extname(audioFile))) {
        singleFiles.push(audioFile);
      }
    });

    let fetchCueAwait: Array<Promise<void>> = [];

    cueFiles.forEach((cueFile) => {
      let cueMetadata = cueParser.parse(cueFile);
      let dirname = path.dirname(cueFile);

      // add album
      if (!this.animeEntryInfo.music[cueMetadata.title]) {
        this.animeEntryInfo.music[cueMetadata.title] = [];
      }

      cueMetadata.files.forEach((file: any) => {
        // remove related files and get duration
        let relatedFile = path.join(dirname, file.name);
        let relatedFileIdx = singleFiles.indexOf(relatedFile);
        if (relatedFileIdx === -1) {
          console.log('cannot find ', relatedFile);
          return; // cannot find file, just skip
        }
        singleFiles.splice(relatedFileIdx, 1);
        fetchCueAwait.push(this.fetchCueMetadata(file, relatedFile, cueMetadata.title));
      });
    });

    await Promise.all(fetchCueAwait);

    const fetchAwait: Array<Promise<void>> = singleFiles.map((singleFile) => {
      return this.fetchMusicMetaData(singleFile);
    });

    await Promise.all(fetchAwait);
  }

  getAnimeEntryInfo(): animeEntryInfoType {
    return this.animeEntryInfo;
  }

  // update
  updateAnimeInfoTitle(newTitle: string) {
    deleteFile(path.join(animeEntryPath, this.animeEntryInfo.title + '.json'));

    this.animeEntryInfo.title = newTitle;
    this.saveToFile();
  }

  updateAnimeInfoVideoSectionTitle(dirname: string, newTitle: string) {
    for (let entry of this.animeEntryInfo.video) {
      if (entry.dirname === dirname) {
        entry.name = newTitle;
      }
    }
    this.saveToFile();
  }

  updateAnimeInfoVideoSectionOrder(dirname: string, neworder: Array<number>) {
    for (let entry of this.animeEntryInfo.video) {
      if (entry.dirname === dirname) {
        const newVideos: Array<animeEntryInfoVideoType> = neworder.map((index) => {
          return entry.videos[index];
        });
        entry.videos = newVideos;
      }
    }
    this.saveToFile();
  }

  updateAnimeInfoVideoEpisodeData(
    dirname: string,
    episodeData: Array<{ title: string; secondTitle: string; airdate: string; desc: string }>
  ) {
    for (let entry of this.animeEntryInfo.video) {
      if (entry.dirname === dirname) {
        const minIdx = Math.min(entry.videos.length, episodeData.length);
        for (let idx = 0; idx < minIdx; ++idx) {
          entry.videos[idx].title = episodeData[idx].title;
          entry.videos[idx].secondTitle = episodeData[idx].secondTitle;
          entry.videos[idx].airdate = episodeData[idx].airdate;
          entry.videos[idx].desc = episodeData[idx].desc;
        }
      }
    }
    this.saveToFile();
  }

  updateAnimeInfoVideoEpisodeInfo(videoPath: string, type: 'title' | 'secondTitle' | 'desc', newValue: string) {
    for (let section of this.animeEntryInfo.video) {
      for (let episode of section.videos) {
        const fullPath: string = path.join(this.animeEntryInfo.path, section.dirname, episode.basename);
        if (fullPath === videoPath) {
          switch (type) {
            case 'title':
              episode.title = newValue;
              break;
            case 'secondTitle':
              episode.secondTitle = newValue;
              break;
            case 'desc':
              episode.desc = newValue;
              break;
          }
        }
      }
    }
    this.saveToFile();
  }

  removeAllVideoSnapshots() {
    for (let section of this.animeEntryInfo.video) {
      for (let episode of section.videos) {
        const fullPath: string = path.join(this.animeEntryInfo.path, section.dirname, episode.basename);
        const snapshotPath = path.join(snapshotCachePath, md5.hex(fullPath) + '.jpg');
        if (fs.existsSync(snapshotPath)) {
          deleteFile(snapshotPath);
        }
      }
    }
  }
}

let currentAnimeEntryInspector: AnimeEntryInspector;

ipcMain.on('shellOpenPath', async (event: Electron.IpcMainEvent, path: string) => {
  if (await shell.openPath(path)) {
    event.reply('showErrorMessage', 'Open failed! Check the folder and try re-inspect!');
  }
});

ipcMain.on('shellShowItem', (_event: Electron.IpcMainEvent, path: string) => {
  shell.showItemInFolder(path);
});

ipcMain.on('shellOpenUrl', (_event: Electron.IpcMainEvent, url: string) => {
  shell.openExternal(url);
});

ipcMain.on('openCurrentAnimeInfoFile', (_event: Electron.IpcMainEvent) => {
  shell.openPath(path.join(animeEntryPath, currentAnimeEntryInspector.getAnimeEntryInfo().title + '.json'));
});

ipcMain.on('animeTabClose', (event: Electron.IpcMainEvent) => {
  event.reply('removeAnimeTab');
  event.reply('clearEntrySelect');
});

/**
 * update anime title
 */
ipcMain.on('updateAnimeTitle', (event: Electron.IpcMainEvent, oldTitle: string, newTitle: string) => {
  if (animeInfoList.existAnime(newTitle)) {
    // title already exist, reject
    event.reply('showErrorMessage', 'Anime title has already existed.');
  } else {
    animeInfoList.updateAnimeTitle(oldTitle, newTitle);
    currentAnimeEntryInspector.updateAnimeInfoTitle(newTitle);

    event.reply('updateAnimeEntry', animeInfoList.getAllAnimeTitle());
    event.reply('createAnimeDetailTab', currentAnimeEntryInspector.getAnimeEntryInfo());
  }
});

/**
 * ipc reinspect
 */
ipcMain.on('animeReInspect', async (event: Electron.IpcMainEvent, title: string) => {
  if (currentAnimeEntryInspector.getAnimeEntryInfo().title !== title) {
    event.reply('showErrorMessage', 'Re-inspect failed! Check the folder and retry!');
    return;
  }

  const inspectResult: 'OK' | 'fail' | 'question' = await currentAnimeEntryInspector.inspect(true);
  if (inspectResult === 'OK') {
    event.sender.send('createAnimeDetailTab', currentAnimeEntryInspector.getAnimeEntryInfo());
  } else if (inspectResult === 'fail') {
    event.reply('showErrorMessage', 'Re-inspect failed! Check the folder and retry!');
  } else {
    // Reinspect wouldn't reply question, do nothing.
  }
});

/**
 * fetch metadata from bangumi by bangumiID
 */
ipcMain.on('fetchMetadataByID', async (event: Electron.IpcMainEvent, bangumiID: string) => {
  let progressBar = new ProgressBar({
    text: 'Fetching metadata from Bangumi...',
    detail: 'ID: ' + bangumiID,
    browserWindow: { parent: mainWindow },
    style: {
      text: { fontSize: '26px', color: 'white' },
      detail: { fontSize: '20px', lineHeight: '20px', color: 'white', overflow: 'hidden' },
      bar: { background: 'lightgrey' },
      value: { background: settings.getThemeColor() },
    },
  });

  try {
    const metadataJson = await fetchBangumiAPI(bangumiID);

    let metadata: AnimeEntryInfoMetadataType = {
      bangumiID: metadataJson.id,
      airDate: metadataJson.air_date,
      airWeekday: metadataJson.air_weekday,
      summary: metadataJson.summary.replaceAll('\r\n', '\n'),
      imagePath: metadataJson.images.large,
      staff: {},
      character: [],
    };

    metadataJson.staff.forEach((staff: any) => {
      staff.jobs.forEach((job: string) => {
        if (!metadata.staff[job]) metadata.staff[job] = [];
        metadata.staff[job].push(staff.name);
      });
    });

    metadataJson.crt.forEach((character: any) => {
      let crtInfo: { id: number; name: string; image: string; actorID?: number; actorName?: string } = {
        id: character.id,
        name: character.name,
        image: character.images.grid,
      };

      if (character.actors.length > 0) {
        crtInfo.actorID = character.actors[0].id;
        crtInfo.actorName = character.actors[0].name;
      }

      metadata.character.push(crtInfo);
    });

    currentAnimeEntryInspector.setMetadata(metadata);
    event.reply('createAnimeDetailTab', currentAnimeEntryInspector.getAnimeEntryInfo());
  } catch (err) {
    log.error(err);
    event.reply('showErrorMessage', 'Fetch failed, check your network and bangumi ID.');
  }
  progressBar.close();
});

/**
 * fetch metadata from bangumi by Name
 */
ipcMain.on('fetchMetadataByName', async (event: Electron.IpcMainEvent, name: string) => {
  let progressBar = new ProgressBar({
    text: 'Fetching anime information from Bangumi...',
    detail: 'Anime: ' + name,
    browserWindow: { parent: mainWindow },
    style: {
      text: { fontSize: '26px', color: 'white' },
      detail: { fontSize: '20px', lineHeight: '20px', color: 'white', overflow: 'hidden' },
      bar: { background: 'lightgrey' },
      value: { background: settings.getThemeColor() },
    },
  });

  try {
    const metadataJson = await searchBangumiAPI(name);
    let animeList: Array<string> = [];

    metadataJson.list.forEach((item: any) => {
      animeList.push(item.id, item.name, item.name_cn, item.images.grid);
    });

    event.reply('showSelectList', animeList);
  } catch (err) {
    log.error(err);
    event.reply('showErrorMessage', 'Fetch failed, check your network and anime name.');
  }
  progressBar.close();
});

/**
 * update anime video section title
 */
ipcMain.on('updateAnimeVideoSectionTitle', (event: Electron.IpcMainEvent, dirname: string, newTitle: string) => {
  currentAnimeEntryInspector.updateAnimeInfoVideoSectionTitle(dirname, newTitle);
  event.reply('createAnimeDetailTab', currentAnimeEntryInspector.getAnimeEntryInfo());
});

/**
 * fetch bangumi metadata to update episode info in video section
 */
ipcMain.on('fetchEpisodeData', async (event: Electron.IpcMainEvent, bangumiID: string, folder: string) => {
  try {
    const metadataJson = await fetchBangumiAPI(bangumiID);
    let episodeData: Array<{ title: string; secondTitle: string; airdate: string; desc: string }> = [];
    metadataJson.eps.forEach((eps: any) => {
      if (eps.type === 0) {
        episodeData.push({
          title: eps.name,
          secondTitle: eps.name_cn,
          airdate: eps.airdate,
          desc: eps.desc.replaceAll('\r\n', '\n'),
        });
      }
    });

    currentAnimeEntryInspector.updateAnimeInfoVideoEpisodeData(folder, episodeData);
    event.reply('createAnimeDetailTab', currentAnimeEntryInspector.getAnimeEntryInfo());
  } catch (err) {
    console.log(err);
    event.reply('showErrorMessage', 'Fetch failed, check your network and bangumi ID.');
  }
});

// update anime video section order
ipcMain.on('updateAnimeVideoSectionOrder', (event: Electron.IpcMainEvent, dirname: string, newOrder: Array<number>) => {
  currentAnimeEntryInspector.updateAnimeInfoVideoSectionOrder(dirname, newOrder);
  event.reply('createAnimeDetailTab', currentAnimeEntryInspector.getAnimeEntryInfo());
});

// update anime video episode info
ipcMain.on(
  'updateAnimeVideoEpisodeInfo',
  (event: Electron.IpcMainEvent, videoPath: string, type: 'title' | 'secondTitle' | 'desc', newValue: string) => {
    currentAnimeEntryInspector.updateAnimeInfoVideoEpisodeInfo(videoPath, type, newValue);
    event.reply('createAnimeDetailTab', currentAnimeEntryInspector.getAnimeEntryInfo());
  }
);

ipcMain.handle(
  'getVideoSnapshotPath',
  async (_event: Electron.IpcMainEvent, file: string): Promise<string> => {
    const cacheMD5 = md5.hex(file);
    const outputPath = path.join(snapshotCachePath, cacheMD5 + '.jpg');
    return outputPath;
  }
);

let mainWindow: BrowserWindow | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true') {
  require('electron-debug')({ showDevTools: false });
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true') {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  new settingChecker();

  mainWindow = new BrowserWindow({
    show: false,
    width: settings.getSettings().windowWidth,
    height: settings.getSettings().windowHeight,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL(`file://${__dirname}/index.html`);

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('resize', () => {
    if (mainWindow) {
      let { width, height } = mainWindow.getBounds();
      settings.setWindowSize(width, height);
    }
  });

  mainWindow.on('close', () => {
    settings.save();
    animeInfoList.save();

    mainWindow = null;
  });

  // Open urls in the user's browser
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
};

app.disableHardwareAcceleration();

/**
 * Add event listeners...
 */
app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(createWindow).catch(console.log);

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});
