import React from 'react';
import { ipcRenderer } from 'electron';
import { ControlledMenu, Menu, MenuButton, MenuDivider, MenuHeader, MenuItem, SubMenu } from '@szhsin/react-menu';
import path from 'path';
import {
  AnimeEntryInfoMetadataType,
  animeEntryInfoMusicAlbumType,
  animeEntryInfoType,
  animeEntryInfoVideoSectionType,
  animeEntryInfoVideoType,
} from '../../types';
import { DialogContext } from '../dialog';
import { icons } from '../utilities';
import bgmIcon from '../../../assets/bgmIcon.png';
import './animepanel.global.css';

const weekdayConverter = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

class MetadataSection extends React.Component<{ metadata: AnimeEntryInfoMetadataType }, {}> {
  static contextType = DialogContext;
  context!: React.ContextType<typeof DialogContext>;

  render(): JSX.Element {
    const metadata = this.props.metadata;
    const themeImg = metadata.imagePath ? <img className="shadowBox" src={metadata.imagePath} /> : undefined;

    const summary: Array<JSX.Element> = metadata.summary.split('\n').map((paragraph: string, index: number) => {
      return (
        <p key={index} style={{ textIndent: this.context.settings.metadataDescTextIndent + 'em' }}>
          {paragraph}
        </p>
      );
    });

    let staffList: Array<JSX.Element> = [];
    for (const job in metadata.staff) {
      const staff = metadata.staff[job].toString();
      staffList.push(
        <div key={job} title={job + ': ' + staff}>
          <p className="oneLineText">
            {job}: {staff}
          </p>
        </div>
      );
    }

    const characterList: Array<JSX.Element> = metadata.character.map((character) => {
      return (
        <div className="metadataCharacter" key={character.id}>
          <img src={character.image} />
          <p
            className="oneLineText pointerCursor"
            title={character.name}
            onClick={() => ipcRenderer.send('shellOpenUrl', 'https://bgm.tv/character/' + character.id)}>
            {character.name}
          </p>
          <p
            className="oneLineText  pointerCursor"
            title={character.actorName}
            onClick={() => ipcRenderer.send('shellOpenUrl', 'https://bgm.tv/person/' + character.actorID)}>
            CV: {character.actorName}
          </p>
        </div>
      );
    });

    return (
      <div className="metadataSection">
        <div>
          {themeImg}
          <section className="panelSection rowWrapper metadataLinks">
            <div
              className="pointerCursor"
              title={'bangumi ' + metadata.bangumiID}
              onClick={() => ipcRenderer.send('shellOpenUrl', 'https://bangumi.tv/subject/' + metadata.bangumiID)}>
              <img src={bgmIcon} />
            </div>
          </section>
        </div>

        <div className="metadataSubsection">
          <section className="panelSection">{summary}</section>

          <section className="panelSection metadataInfoGrid">
            <div>
              <p className="oneLineText">
                On air: {metadata.airDate} <i>{weekdayConverter[metadata.airWeekday]}</i>
              </p>
            </div>
            {staffList}
          </section>

          <section className="panelSection metadataInfoGrid">{characterList}</section>
        </div>
      </div>
    );
  }
}

class VideoCard extends React.Component<
  { videoPath: string; videoCardInfo: animeEntryInfoVideoType; isListLayout: boolean },
  { contextMenuOpen: boolean; anchorPoint: { x: number; y: number }; snapshotPath: string }
> {
  state = { contextMenuOpen: false, anchorPoint: { x: 0, y: 0 }, snapshotPath: '' };

  desc: React.RefObject<HTMLDivElement> = React.createRef();

  static contextType = DialogContext;
  context!: React.ContextType<typeof DialogContext>;

  async componentDidMount() {
    const snapshotPath = await ipcRenderer.invoke('getVideoSnapshotPath', this.props.videoPath);
    this.setState({ snapshotPath: snapshotPath });
  }

  handleContextMenu(event: React.MouseEvent) {
    event.preventDefault();
    this.setState({
      contextMenuOpen: true,
      anchorPoint: { x: event.clientX, y: event.clientY },
    });
  }

  handleEpisodeInfoClick(type: 'title' | 'secondTitle' | 'desc') {
    const videoInfo: animeEntryInfoVideoType = this.props.videoCardInfo;
    const dialogMode = type === 'desc' ? 'promptTextarea' : 'prompt';
    let value: string = '';
    switch (type) {
      case 'title':
        value = videoInfo.title ? videoInfo.title : videoInfo.basename;
        break;
      case 'secondTitle':
        value = videoInfo.secondTitle ? videoInfo.secondTitle : '';
        break;
      case 'desc':
        value = videoInfo.desc ? videoInfo.desc : '';
        break;
    }

    this.context.openDialog(dialogMode, {
      type: 'episodeInfo',
      value: value,
      info: [type, this.props.videoPath],
      msg: 'Please input new episode ' + type + ':',
    });
  }

  handleSnapshotClick() {
    this.context.openDialog('prompt', {
      type: 'videoSnapshot',
      value: '',
      info: [this.props.videoPath],
      msg: 'Please indicate the timestamp you want to set (e.g. 23:59, 1:01:01 or 99%).',
    });
  }

  handleShowDesc() {
    if (this.desc.current) {
      this.desc.current.style.animation = 'anime-card-show 1s ease forwards';
    }
  }

  handleHideDesc() {
    if (this.desc.current) {
      this.desc.current.style.animation = 'anime-card-hide 1s ease forwards';
    }
  }

  handleSubtitleClick(ext: string) {
    const parsed = path.parse(this.props.videoPath);
    ipcRenderer.send('shellShowItem', path.join(parsed.dir, parsed.name + ext));
  }

  handleMkaClick() {
    const parsed = path.parse(this.props.videoPath);
    ipcRenderer.send('shellShowItem', path.join(parsed.dir, parsed.name + '.mka'));
  }

  renderCardMenu(): JSX.Element {
    return (
      <ControlledMenu
        anchorPoint={this.state.anchorPoint}
        isOpen={this.state.contextMenuOpen}
        onClose={() => {
          this.setState({ contextMenuOpen: false });
        }}>
        <MenuItem onClick={() => ipcRenderer.send('shellOpenPath', this.props.videoPath)}>Play</MenuItem>
        <MenuItem onClick={() => ipcRenderer.send('shellShowItem', this.props.videoPath)}>Show Episode</MenuItem>
        <MenuDivider />
        <MenuHeader>Edit</MenuHeader>
        <MenuItem onClick={() => this.handleEpisodeInfoClick('title')}>Title</MenuItem>
        <MenuItem onClick={() => this.handleEpisodeInfoClick('secondTitle')}>Second Title</MenuItem>
        <MenuItem onClick={() => this.handleEpisodeInfoClick('desc')}>Intro</MenuItem>
        <MenuItem onClick={() => this.handleSnapshotClick()}>Snapshot</MenuItem>
      </ControlledMenu>
    );
  }

  render(): JSX.Element {
    const videoInfo: animeEntryInfoVideoType = this.props.videoCardInfo;

    const wrapperClassName: string = this.props.isListLayout ? 'videoCardListLayout' : 'videoCardGridLayout';
    const innerWrapperClassName: string = this.props.isListLayout
      ? 'videoCardInnerListLayout'
      : 'videoCardInnerGridLayout';
    const playButtonClassName: string = this.props.isListLayout
      ? 'videoCardPlayWrapperList'
      : 'videoCardPlayWrapperGrid';

    const titleClassName: string =
      'videoCardPanelTitle pointerCursor ' + (this.props.isListLayout ? 'oneLineText' : 'twoLineText');

    let descParagraph: Array<JSX.Element> = [];
    if (videoInfo.desc && videoInfo.desc !== '') {
      videoInfo.desc.split('\n').forEach((paragraph: string, index: number) => {
        descParagraph.push(paragraph === '' ? <br key={index} /> : <p key={index}>{paragraph}</p>);
      });
    }

    const episodeInfo: JSX.Element | null = this.props.isListLayout ? (
      <p className="episodeInfo">
        Size: {videoInfo.size} / Duration: {videoInfo.duration} / Resolution: {videoInfo.resolution}{' '}
        {videoInfo.airdate ? ' / Airdate: ' + videoInfo.airdate : ''}
      </p>
    ) : null;

    // show subtitles
    const subtitleSpans: Array<JSX.Element> = videoInfo.subtitles.map((subtitle: string, index: number) => {
      const isBuiltIn = subtitle[0] !== '.';
      const subtitleShow: string = isBuiltIn ? subtitle : subtitle.slice(1).toUpperCase();

      return (
        <div
          className={(isBuiltIn ? '' : 'pointerCursor ') + 'videoCardPanelSubtitle unselectable'}
          style={{ backgroundColor: isBuiltIn ? 'lightblue' : 'lightgreen' }}
          onClick={isBuiltIn ? undefined : () => this.handleSubtitleClick(subtitle)}
          key={index}>
          {icons.caption} {subtitleShow}
        </div>
      );
    });

    // show audio track
    const audioTrackSpans: Array<JSX.Element> = videoInfo.audio.map((audio: string, index: number) => {
      const nameIndexStart = audio.indexOf('<');
      const nameIndexEnd = audio.lastIndexOf('>');

      if (nameIndexStart !== -1 && nameIndexEnd !== -1 && audio.slice(0, 4) === 'MKA:') {
        return (
          <div
            className="videoCardPanelAudio pointerCursor unselectable"
            style={{ backgroundColor: 'seashell' }}
            key={index}
            onClick={() => this.handleMkaClick()}
            title={audio.slice(4)}>
            {icons.audioTrackMka}
            {audio.slice(4, nameIndexStart) + audio.slice(nameIndexEnd + 2)}
          </div>
        );
      }

      if (audio.slice(0, 4) === 'MKA:') {
        return (
          <div
            className="videoCardPanelAudio pointerCursor unselectable"
            style={{ backgroundColor: 'seashell' }}
            key={index}
            onClick={() => this.handleMkaClick()}>
            {icons.audioTrackMka}
            {audio.slice(4)}
          </div>
        );
      }

      if (nameIndexStart !== -1 && nameIndexEnd !== -1) {
        return (
          <div
            className="videoCardPanelAudio unselectable"
            style={{ backgroundColor: 'lightyellow' }}
            key={index}
            title={audio}>
            {icons.audioTrack}
            {audio.slice(0, nameIndexStart) + audio.slice(nameIndexEnd + 2)}
          </div>
        );
      }

      return (
        <div className="videoCardPanelAudio unselectable" style={{ backgroundColor: 'lightyellow' }} key={index}>
          {icons.audioTrack}
          {audio}
        </div>
      );
    });

    const fileInfo: JSX.Element | null = this.props.isListLayout ? (
      <div className="videoCardPanelAudioSubtitle">
        {audioTrackSpans.length > 0 ? audioTrackSpans : undefined}
        {subtitleSpans.length > 0 ? subtitleSpans : undefined}
      </div>
    ) : null;

    const descPanel: JSX.Element | null =
      descParagraph.length === 0 ? null : (
        <div className="videoCardPanelDesc innerScrollList" ref={this.desc}>
          <button onClick={() => this.handleHideDesc()}>&times;</button>
          <h4 className="unselectable pointerCursor" onClick={() => this.handleHideDesc()}>
            Episode Intro
          </h4>
          {descParagraph}
        </div>
      );

    return (
      <div
        className={wrapperClassName + ' shadowBox'}
        onContextMenu={(event) => {
          this.handleContextMenu(event);
        }}>
        <div className={innerWrapperClassName}>
          <img src={this.state.snapshotPath} onClick={() => this.handleShowDesc()} />
          <div className="videoCardPanel">
            <div className="videoCardPanelTitleWrapper">
              <span className={titleClassName} onClick={() => this.handleShowDesc()}>
                {videoInfo.title ? videoInfo.title : videoInfo.basename}
              </span>
              <span
                className="videoCardPanelSecondTitle pointerCursor oneLineText"
                onClick={() => this.handleShowDesc()}>
                {videoInfo.secondTitle}
              </span>
            </div>
            {episodeInfo}
            {fileInfo}
            {this.props.isListLayout ? descPanel : null}
          </div>
          {this.props.isListLayout ? null : descPanel}
        </div>
        <div
          className={playButtonClassName + ' videoCardPlayWrapper pointerCursor'}
          onClick={() => ipcRenderer.send('shellOpenPath', this.props.videoPath)}>
          {icons.play}
        </div>
        {this.renderCardMenu()}
      </div>
    );
  }
}

class VideoSection extends React.Component<
  { id: string; path: string; videoSectionInfo: animeEntryInfoVideoSectionType },
  { isArchived: boolean; isListLayout: boolean }
> {
  state = { isArchived: false, isListLayout: this.context.settings.videoSectionLayout === 'list' };

  static contextType = DialogContext;
  context!: React.ContextType<typeof DialogContext>;

  handleRenameClick() {
    this.context.openDialog('prompt', {
      type: 'videoSectionTitle',
      value: this.props.videoSectionInfo.name ? this.props.videoSectionInfo.name : this.props.videoSectionInfo.dirname,
      info: [this.props.videoSectionInfo.dirname],
      msg: 'Please input new video section title:',
    });
  }

  handleShowHideClick() {
    const currentState = !this.state.isArchived;
    this.setState({ isArchived: currentState });
  }

  handleLayoutModeClick() {
    const currentMode = !this.state.isListLayout;
    this.setState({ isListLayout: currentMode });
  }

  handleOpenClick() {
    ipcRenderer.send('shellOpenPath', path.join(this.props.path, this.props.videoSectionInfo.dirname));
  }

  handleEpisodeDataClick() {
    this.context.openDialog('prompt', {
      type: 'fetchEpisodeData',
      value: '',
      info: [this.props.videoSectionInfo.dirname],
      msg: 'Please input bangumi ID:',
    });
  }

  handleSortClick() {
    let videoList: Array<string> = [this.props.videoSectionInfo.dirname];
    this.props.videoSectionInfo.videos.forEach((video) => {
      videoList.push(video.title ? video.title : video.basename);
    });

    this.context.openDialog('sortList', {
      type: 'videoSectionSort',
      value: this.props.videoSectionInfo.name ? this.props.videoSectionInfo.name : this.props.videoSectionInfo.dirname,
      info: videoList,
    });
  }

  renderVideoOperationList(): JSX.Element {
    const menuItemSort =
      this.props.videoSectionInfo.videos.length > 1 ? (
        <MenuItem onClick={() => this.handleSortClick()}>Sort</MenuItem>
      ) : (
        <MenuItem disabled>Sort</MenuItem>
      );

    return (
      <Menu menuButton={<MenuButton>{icons.sectionMenu}</MenuButton>} align={'end'}>
        <MenuItem onClick={() => this.handleShowHideClick()}>{this.state.isArchived ? 'Show' : 'Hide'}</MenuItem>
        <MenuItem onClick={() => this.handleOpenClick()}>Open Folder</MenuItem>
        <MenuDivider />
        <MenuHeader>Edit</MenuHeader>
        <MenuItem onClick={() => this.handleRenameClick()}>Rename</MenuItem>
        <MenuItem onClick={() => this.handleEpisodeDataClick()}>Fetch Episode Data</MenuItem>

        {menuItemSort}
      </Menu>
    );
  }

  render(): JSX.Element {
    const sectionInfo: animeEntryInfoVideoSectionType = this.props.videoSectionInfo;

    const videoList: Array<JSX.Element> = sectionInfo.videos.map((video) => {
      return (
        <VideoCard
          key={video.basename}
          videoPath={path.join(this.props.path, sectionInfo.dirname, video.basename)}
          videoCardInfo={video}
          isListLayout={this.state.isListLayout}
        />
      );
    });

    return (
      <div className="videoSectionWrapper" id={this.props.id}>
        <div className="videoSectionTitle unselectable">
          {icons.videoIcon}
          <span>{sectionInfo.name ? sectionInfo.name : sectionInfo.dirname}</span>
          <button onClick={() => this.handleLayoutModeClick()}>
            {this.state.isListLayout ? icons.listLayout : icons.gridLayout}
          </button>
          {this.renderVideoOperationList()}
        </div>
        {this.state.isArchived ? undefined : (
          <div className={this.state.isListLayout ? 'videoContentWrapper' : 'videoContentWrapperGrid'}>{videoList}</div>
        )}
      </div>
    );
  }
}

class MusicAlbum extends React.Component<{ id: string; title: string; album: animeEntryInfoMusicAlbumType }, {}> {
  render() {
    function formatTime(totalSeconds: number): string {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor(totalSeconds / 60) % 60;
      const seconds = Math.round(totalSeconds % 60);

      return (hours === 0 ? '' : hours + ':') + minutes + ':' + (seconds > 9 ? seconds : '0' + seconds);
    }

    let albumList: Array<JSX.Element> = [];
    this.props.album.forEach((single) => {
      albumList.push(
        <tr key={albumList.length}>
          <td className="audioCardTitle">{single.title}</td>
          <td className="audioCardArtist">
            <span className="oneLineText">{single.artist}</span>
          </td>
          <td className="audioCardDuration">{formatTime(single.duration)}</td>
        </tr>
      );
    });
    return (
      <table className="audioCard shadowBox" id={this.props.id}>
        <caption>{this.props.title}</caption>
        <tbody>{albumList}</tbody>
      </table>
    );
  }
}

class AnimeTab extends React.Component<{ entryInfo: animeEntryInfoType }, {}> {
  static contextType = DialogContext;
  context!: React.ContextType<typeof DialogContext>;

  handleRenameClick() {
    this.context.openDialog('prompt', {
      type: 'title',
      value: this.props.entryInfo.title,
      msg: 'Please input new anime title:',
    });
  }

  handleFetchMetadataByIDClick() {
    this.context.openDialog('prompt', {
      type: 'fetchMetadataByID',
      value: '',
      msg: 'Please input bangumi id:',
    });
  }

  handleFetchMetadataByNameClick() {
    this.context.openDialog('prompt', {
      type: 'fetchMetadataByName',
      value: this.props.entryInfo.title,
      msg: 'Please input anime title:',
    });
  }

  handlePanelListClick(panelId: string) {
    const gotoPageSelection = function () {
      let anchorElement = document.getElementById(panelId);
      if (anchorElement) {
        anchorElement.scrollIntoView({ behavior: 'smooth' });
      }
      clearInterval(timer);
      clearTimeout(timer);
    };
    let timer = setInterval(gotoPageSelection, 100);
  }

  handleDeleteAnimeClick() {
    this.context.openDialog('question', {
      type: 'deleteAnimeEntry',
      value: this.props.entryInfo.title,
      msg: 'Do you want to delete this anime?',
      checked: true,
      checkMsg: 'Also delete anime inspect info.',
    });
  }

  renderTabMenu(): JSX.Element {
    const animeEntry = this.props.entryInfo;
    return (
      <Menu menuButton={<MenuButton>{icons.list}</MenuButton>} align="end" position="anchor">
        <MenuItem onClick={() => ipcRenderer.send('shellOpenPath', animeEntry.path)}>Open Folder</MenuItem>
        <MenuItem onClick={() => ipcRenderer.send('openCurrentAnimeInfoFile', animeEntry.path)}>
          Open Metadata File
        </MenuItem>
        <MenuItem onClick={() => ipcRenderer.send('animeTabClose')}>Close Tab</MenuItem>
        <MenuDivider />

        <MenuHeader>Edit</MenuHeader>
        <MenuItem onClick={() => this.handleRenameClick()}>Rename</MenuItem>
        <MenuItem onClick={() => ipcRenderer.send('animeReInspect', animeEntry.title)}>Re-Inspect</MenuItem>
        <SubMenu label="Metadata">
          <MenuHeader>Fetch By</MenuHeader>
          <MenuItem onClick={() => this.handleFetchMetadataByIDClick()}>Bangumi ID</MenuItem>
          <MenuItem onClick={() => this.handleFetchMetadataByNameClick()}>Name</MenuItem>
          <MenuDivider />
          <MenuHeader>Edit</MenuHeader>
          <MenuItem>Theme Pic</MenuItem>
          <MenuItem>Summary</MenuItem>
          <MenuItem>On Air Date</MenuItem>
        </SubMenu>

        <MenuDivider />
        <MenuItem styles={{ color: 'red' }} onClick={() => this.handleDeleteAnimeClick()}>
          Delete
        </MenuItem>
      </Menu>
    );
  }

  render(): JSX.Element {
    const animeEntry = this.props.entryInfo;

    let panelList: Array<JSX.Element> = [];

    let videoSectionList: Array<JSX.Element> = [];
    animeEntry.video.forEach((videoSection: animeEntryInfoVideoSectionType) => {
      const panelId = 'videoPanel' + videoSectionList.length;

      videoSectionList.push(
        <VideoSection
          key={videoSectionList.length}
          id={panelId}
          path={animeEntry.path}
          videoSectionInfo={videoSection}
        />
      );

      panelList.push(
        <MenuItem key={videoSection.dirname} onClick={() => this.handlePanelListClick(panelId)}>
          {videoSection.name ? videoSection.name : videoSection.dirname}
        </MenuItem>
      );
    });

    let audioList: Array<JSX.Element> = [];
    for (const album in animeEntry.music) {
      const panelId = 'audioPanel' + audioList.length;

      audioList.push(<MusicAlbum id={panelId} key={audioList.length} title={album} album={animeEntry.music[album]} />);

      panelList.push(
        <MenuItem key={album} onClick={() => this.handlePanelListClick(panelId)}>
          {album}
        </MenuItem>
      );
    }

    const animeTitleStyle: React.CSSProperties = {
      fontSize: this.context.settings.videoTitleFontSize + 'px',
      color: this.context.settings.videoTitleColor,
    };

    return (
      <div className="animeTab innerScrollList">
        <div className="titleWrapper">
          <Menu
            menuButton={
              <span className="pointerCursor" style={animeTitleStyle}>
                {animeEntry.title}
              </span>
            }
            align="start"
            overflow="auto"
            position="anchor"
            className="innerScrollList">
            {panelList}
          </Menu>
          {this.renderTabMenu()}
        </div>
        {animeEntry.metadata ? <MetadataSection metadata={animeEntry.metadata} /> : undefined}
        {videoSectionList}
        {audioList}
      </div>
    );
  }
}

class AnimePanel extends React.Component<{}, { animeTabs: Array<JSX.Element> }> {
  state = { animeTabs: [] };

  static contextType = DialogContext;
  context!: React.ContextType<typeof DialogContext>;

  componentDidMount() {
    ipcRenderer.on('createAnimeDetailTab', this.createAnimeDetailTab);
    ipcRenderer.on('removeAnimeTab', this.removeAnimeTab);
    ipcRenderer.on('showErrorMessage', this.showErrorMessage);
    ipcRenderer.on('showSelectList', this.showSelectList);
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('createAnimeDetailTab', this.createAnimeDetailTab);
    ipcRenderer.removeListener('removeAnimeTab', this.removeAnimeTab);
    ipcRenderer.removeListener('showErrorMessage', this.showErrorMessage);
    ipcRenderer.removeListener('showSelectList', this.showSelectList);
  }

  createAnimeDetailTab = (_event: Electron.IpcRendererEvent, entry: animeEntryInfoType) => {
    let tabs = [];
    tabs.push(<AnimeTab key={entry.path} entryInfo={entry} />);
    this.setState({ animeTabs: tabs });
  };

  removeAnimeTab = (_event: Electron.IpcRendererEvent) => {
    this.setState({ animeTabs: [] });
  };

  showErrorMessage = (_event: Electron.IpcRendererEvent, errorMessage: string) => {
    this.context.openDialog('error', { type: '', value: errorMessage });
  };

  showSelectList = (_event: Electron.IpcRendererEvent, animeList: Array<string>) => {
    this.context.openDialog('selectList', { type: 'bangumiEntrySelection', value: '', info: animeList });
  };

  render(): JSX.Element {
    return <div className="animePanel">{this.state.animeTabs}</div>;
  }
}

export { AnimePanel };
