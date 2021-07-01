import React from 'react';
import './leftnav.global.css';
import { DialogContext } from '../dialog';
import { icons } from '../utilities';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { ipcRenderer } from 'electron';
import { Menu, MenuItem, MenuButton, MenuHeader, MenuDivider } from '@szhsin/react-menu';

class LeftNav extends React.Component<{}, { animeInfoList: Array<string>; selected: string | undefined }> {
  state = { animeInfoList: [], selected: undefined };

  static contextType = DialogContext;
  context!: React.ContextType<typeof DialogContext>;

  async componentDidMount() {
    ipcRenderer.on('updateAnimeEntry', this.updateAnimeEntry);
    ipcRenderer.on('clearEntrySelect', this.clearEntrySelect);
    ipcRenderer.on('showAnimeDeleteQuestionMessage', this.showAnimeDeleteQuestionMessage);
    this.setState({ animeInfoList: await ipcRenderer.invoke('getAnimeList') });
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

  handleSortClick(mode: 'name' | 'date') {
    (async () => {
      this.setState({ animeInfoList: await ipcRenderer.invoke('sortAnimeInfoList', mode) });
    })();
  }

  render(): JSX.Element {
    const navHeader: JSX.Element = (
      <div className="titleWrapper leftNavTitleWrapper">
        <h2 style={{ fontSize: this.context.settings.navigatorTitleFontSize + 'px' }}>Anime List</h2>
        <div className="leftNavAnimeAmount">{this.state.animeInfoList.length}</div>
        <Menu menuButton={<MenuButton>{icons.list}</MenuButton>} align="end">
          <MenuHeader>Add</MenuHeader>
          <MenuItem onClick={() => ipcRenderer.send('selectAnimeFolder')}>Folder</MenuItem>
          <MenuItem onClick={() => ipcRenderer.send('selectAnimeContainingFolder')}>Directory</MenuItem>

          <MenuDivider />
          <MenuHeader>Sort By</MenuHeader>
          <MenuItem onClick={() => this.handleSortClick('name')}>Name</MenuItem>
          <MenuItem onClick={() => this.handleSortClick('date')}>On Air Date</MenuItem>
        </Menu>
      </div>
    );

    const isDraggable = this.context.settings.navigatorDraggable;
    const entryFontColor: React.CSSProperties = {
      backgroundImage:
        'linear-gradient(to right, var(--theme-color75), var(--theme-color75) 50%, ' +
        (this.context.settings.navigatorColor === '' ? 'black' : this.context.settings.navigatorColor) +
        ' 50%)',
    };

    const navAnimeEntryList = (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable isDropDisabled={!isDraggable} droppableId="characters">
          {(provided, _snapshot) => (
            <ul
              className="animeList innerScrollList"
              style={{ fontSize: this.context.settings.navigatorFontSize + 'px' }}
              ref={provided.innerRef}
              {...provided.droppableProps}>
              {this.state.animeInfoList.map(
                (title: string, index: number): JSX.Element => (
                  <Draggable key={title} draggableId={title} index={index} isDragDisabled={!isDraggable}>
                    {(provided, snapshot) => {
                      const isSelected: boolean = this.state.selected === title;

                      const dragHandlerStyle: React.CSSProperties = {
                        display: isDraggable ? 'block' : 'none',
                        opacity: snapshot.isDragging ? 1 : undefined,
                      };

                      const spanClassName: string =
                        (isSelected && !snapshot.isDragging ? '' : 'animeEntrySpan') +
                        (this.context.settings.navigatorOneLineText ? ' oneLineText' : '');

                      const spanStyle: React.CSSProperties =
                        isSelected && !snapshot.isDragging ? { color: 'var(--theme-color)' } : entryFontColor;

                      return (
                        <li
                          className={(snapshot.isDragging ? 'animeEntryDragging ' : '') + 'animeEntry pointerCursor'}
                          onClick={() => this.handleClick(title)}
                          ref={provided.innerRef}
                          {...provided.draggableProps}>
                          <span className={spanClassName} style={spanStyle}>
                            {title}
                          </span>
                          <div className="animeEntryDragWrapper" style={dragHandlerStyle} {...provided.dragHandleProps}>
                            {icons.dragIcon}
                          </div>
                          <div className="animeEntrySelected" style={{ display: isSelected ? 'block' : 'none' }}></div>
                        </li>
                      );
                    }}
                  </Draggable>
                )
              )}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    );

    const navToolbar: JSX.Element = (
      <ul className="leftNavToolbar rowWrapper">
        <li onClick={() => this.context.openDialog('settings', { type: '', value: '' })}>{icons.settings}</li>
        <li
          onClick={() => {
            ipcRenderer.send('shellOpenUrl', 'https://github.com/InfiniteSynthesis/anime-preview');
          }}>
          {icons.github}
        </li>
      </ul>
    );

    return (
      <div className="leftNav unselectable" style={{ width: this.context.settings.navigatorWidth + 'vw' }}>
        {navHeader}
        {navAnimeEntryList}
        {navToolbar}
      </div>
    );
  }
}

export { LeftNav };
