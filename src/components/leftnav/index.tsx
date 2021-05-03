import React, { CSSProperties } from 'react';
import './leftnav.global.css';
import { DialogContext } from '../dialog';
import { icons } from '../utilities';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { ipcRenderer } from 'electron';
import { Menu, MenuItem, MenuButton, MenuHeader, MenuDivider } from '@szhsin/react-menu';

class LeftNav extends React.Component<{}, { animeInfoList: string[]; selected: string | undefined }> {
  state = {
    animeInfoList: [],
    selected: undefined,
  };

  static contextType = DialogContext;
  context!: React.ContextType<typeof DialogContext>;

  async componentDidMount() {
    ipcRenderer.on('updateAnimeEntry', this.updateAnimeEntry);
    ipcRenderer.on('clearEntrySelect', this.clearEntrySelect);
    ipcRenderer.on('showAnimeDeleteQuestionMessage', this.showAnimeDeleteQuestionMessage);
    this.setState({ animeInfoList: await ipcRenderer.invoke('getAnimeList') });
    // nav is unique, so load settings after it is once rendered
    this.context.updateSettings(await ipcRenderer.invoke('getSettings'));
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('updateAnimeEntry', this.updateAnimeEntry);
    ipcRenderer.removeListener('clearEntrySelect', this.clearEntrySelect);
    ipcRenderer.removeListener('showAnimeDeleteQuestionMessage', this.showAnimeDeleteQuestionMessage);
  }

  handleClick(title: string) {
    if (this.state.selected === title) return;
    this.setState({ selected: title });
    ipcRenderer.send('animeEntryClick', title);
  }

  updateAnimeEntry = (_event: Electron.IpcRendererEvent, animeTitles: string[]) => {
    this.setState({ animeInfoList: animeTitles });
  };

  clearEntrySelect = (_event: Electron.IpcRendererEvent) => {
    this.setState({ selected: undefined });
  };

  showAnimeDeleteQuestionMessage = (_event: Electron.IpcRendererEvent, title: string) => {
    this.context.openDialog('question', {
      type: 'deleteAnimeEntry',
      value: title,
      msg: 'This anime folder is currently unaccessable or is empty. Do you want to delete this anime?',
    });
  };

  onDragEnd = (result: any) => {
    if (!result.destination) return;
    let newAnimeInfoList = this.state.animeInfoList;
    const [removed] = newAnimeInfoList.splice(result.source.index, 1);
    newAnimeInfoList.splice(result.destination.index, 0, removed);

    ipcRenderer.send('updateAnimeInfoList', result.source.index, result.destination.index);

    this.setState({ animeInfoList: newAnimeInfoList });
  };

  handleSortClick(mode: 'name' | 'date'): void {
    (async () => {
      this.setState({ animeInfoList: await ipcRenderer.invoke('sortAnimeInfoList', mode) });
    })();
  }

  renderNavOperationList(): JSX.Element {
    return (
      <Menu menuButton={<MenuButton>{icons.list}</MenuButton>} align="end">
        <MenuHeader>Add</MenuHeader>
        <MenuItem onClick={() => ipcRenderer.send('selectAnimeFolder')}>Folder</MenuItem>
        <MenuItem onClick={() => ipcRenderer.send('selectAnimeContainingFolder')}>Directory</MenuItem>

        <MenuDivider />
        <MenuHeader>Sort By</MenuHeader>
        <MenuItem onClick={() => this.handleSortClick('name')}>Name</MenuItem>
        <MenuItem onClick={() => this.handleSortClick('date')}>On Air Date</MenuItem>
      </Menu>
    );
  }

  render() {
    const ulStyle: React.CSSProperties = {
      fontSize: this.context.settings.navigatorFontSize + 'px',
      color: this.context.settings.navigatorColor,
    };

    return (
      <div className="leftNav unselectable" style={{ width: this.context.settings.navigatorWidth + 'vw' }}>
        <div className="titleWrapper">
          <span style={{ fontSize: this.context.settings.navigatorTitleFontSize + 'px' }}>
            Anime List [{this.state.animeInfoList.length}]
          </span>
          {this.renderNavOperationList()}
        </div>

        <DragDropContext onDragEnd={this.onDragEnd}>
          <Droppable isDropDisabled={!this.context.settings.navigatorDraggable} droppableId="characters">
            {(provided, _snapshot) => (
              <ul
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="animeList innerScrollList"
                style={ulStyle}>
                {this.state.animeInfoList.map((title: string, index: number) => (
                  <Draggable
                    key={title}
                    draggableId={title}
                    index={index}
                    isDragDisabled={!this.context.settings.navigatorDraggable}>
                    {(provided, snapshot) => (
                      <li
                        className={(snapshot.isDragging ? 'animeEntryDragging ' : '') + 'animeEntry pointerCursor'}
                        onClick={() => this.handleClick(title)}
                        ref={provided.innerRef}
                        {...provided.draggableProps}>
                        <span className={this.context.settings.navigatorOneLineText ? 'oneLineText' : ''}>{title}</span>
                        <div
                          className="animeEntryDragWrapper"
                          {...provided.dragHandleProps}
                          style={{
                            display: this.context.settings.navigatorDraggable ? 'block' : 'none',
                            opacity: snapshot.isDragging ? 1 : undefined,
                          }}>
                          {icons.dragIcon}
                        </div>
                        <div
                          className="animeEntrySelected"
                          style={{ display: this.state.selected === title ? 'block' : 'none' }}></div>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
        <ul className="leftNavToolbar rowWrapper">
          <li onClick={() => this.context.openDialog('settings', { type: '', value: '' })}>{icons.settings}</li>
          <li
            onClick={() => {
              ipcRenderer.send('shellOpenUrl', 'https://github.com/InfiniteSynthesis/anime-preview');
            }}>
            {icons.github}
          </li>
        </ul>
      </div>
    );
  }
}

export { LeftNav };
