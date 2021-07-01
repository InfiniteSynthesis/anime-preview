export interface SettingsListType {
  windowWidth: number;
  windowHeight: number;
  themeColor: string;
  backgroundType: 'color' | 'image' | 'folder';
  backgroundValue: string;
  backgroundOpacity: number;
  font: string;
  navigatorWidth: number;
  navigatorDraggable: boolean;
  navigatorTitleFontSize: number;
  navigatorFontSize: number;
  navigatorColor: string;
  navigatorOneLineText: boolean;
  metadataDescTextIndent: number;
  videoTitleFontSize: number;
  videoTitleColor: string;
  videoSectionLayout: 'list' | 'grid';
  videoSnapshotTimestamp: 'first' | 'random' | 'last' | 'custom';
  videoSnapshotWidth: number;
}

export const defaultSettings: SettingsListType = {
  windowWidth: 1200,
  windowHeight: 800,
  themeColor: '',
  backgroundType: 'image',
  backgroundValue: '../assets/background.jpg',
  backgroundOpacity: 0.4,
  font: '',
  navigatorWidth: 30,
  navigatorDraggable: true,
  navigatorTitleFontSize: 40,
  navigatorFontSize: 16,
  navigatorColor: '',
  navigatorOneLineText: false,
  metadataDescTextIndent: 2,
  videoTitleFontSize: 40,
  videoTitleColor: '',
  videoSectionLayout: 'list',
  videoSnapshotTimestamp: 'random',
  videoSnapshotWidth: 540,
};

export interface AnimeInfoListType extends Array<{ title: string; path: string }> {}

export interface AnimeEntryInfoMetadataType {
  bangumiID: number;
  airDate: string;
  airWeekday: number;
  summary: string;
  imagePath: string;
  staff: { [job: string]: Array<string> };
  character: Array<{ id: number; name: string; image: string; actorID?: number; actorName?: string }>;
}

export interface animeEntryInfoVideoType {
  basename: string;
  duration: string;
  size: string;
  resolution: string;
  audio: Array<string>;
  subtitles: Array<string>;
  title?: string;
  secondTitle?: string;
  airdate?: string;
  desc?: string;
}

export interface animeEntryInfoVideoSectionType {
  dirname: string;
  name?: string;
  videos: Array<animeEntryInfoVideoType>;
}

export interface animeEntryInfoMusicAlbumType
  extends Array<{
    title: string;
    artist: string;
    track: number;
    duration: number;
  }> {}

export interface animeEntryInfoType {
  title: string;
  path: string;
  metadata?: AnimeEntryInfoMetadataType;
  video: Array<animeEntryInfoVideoSectionType>;
  music: {
    [album: string]: animeEntryInfoMusicAlbumType;
  };
}

export interface updateOptionType {
  type: string;
  value: string;
  info?: string[];
  msg?: string;
  checked?: boolean;
  checkMsg?: string;
}
