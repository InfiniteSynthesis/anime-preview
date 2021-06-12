import { ipcRenderer } from 'electron';
import * as React from 'react';
import { updateOptionType } from '../../types';
import './dialog.global.css';
import iconImage from '../../../assets/icon.png';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import Select from 'react-select';
import { SettingsListType, defaultSettings } from '../../types';

type DialogModeType =
  | 'hide'
  | 'question'
  | 'prompt'
  | 'error'
  | 'settings'
  | 'sortList'
  | 'promptTextarea'
  | 'selectList';

export const DialogContext = React.createContext<{
  mode: DialogModeType;
  options: updateOptionType;
  settings: SettingsListType;
  openDialog: (mode: DialogModeType, options: updateOptionType) => void;
  closeDialog: () => void;
  updateSettings: (newSettings: SettingsListType) => void;
}>({
  mode: 'hide',
  options: { type: '', value: '' },
  settings: defaultSettings,
  openDialog: (_mode: DialogModeType, _options: updateOptionType) => {},
  closeDialog: () => {},
  updateSettings: (_newSettings: SettingsListType) => {},
});

const settingsTab = ['General', 'Appearance', 'Navigator', 'Metadata', 'Video', 'Audio'];

const customSelectStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: 0,
  }),
  dropdownIndicator: (provided: any) => ({
    ...provided,
    padding: '0 8px',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  menu: (provided: any) => ({
    ...provided,
    marginTop: '1px',
  }),
  menuList: (provided: any) => ({
    ...provided,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  option: (provided: any) => ({
    ...provided,
    padding: '5px 12px',
  }),
};

const customSelectTheme = (theme: any) => ({
  ...theme,
  borderRadius: 0,
  colors: {
    ...theme.colors,
    primary: 'pink',
    primary75: 'rgba(255, 192, 203, 0.75)',
    primary50: 'rgba(255, 192, 203, 0.5)',
    primary25: 'rgba(255, 192, 203, 0.25)',
  },
});

class PanelSection extends React.Component<
  { category?: string; name: string; desc?: string; checkbox?: { value: boolean; onClick: () => void } },
  {}
> {
  render(): JSX.Element {
    const categorySpan = this.props.category ? (
      <span style={{ fontWeight: 500 }}>{this.props.category}: </span>
    ) : undefined;

    const descParagraph =
      this.props.checkbox && this.props.desc ? (
        <div className="checkboxWrapper unselectable pointerCursor" onClick={this.props.checkbox.onClick}>
          <label className={(this.props.checkbox.value ? 'checkboxChecked ' : '') + 'pointerCursor'} />
          <p>{this.props.desc}</p>
        </div>
      ) : this.props.desc ? (
        <p>{this.props.desc}</p>
      ) : undefined;

    return (
      <section className="panelSection" key={this.props.category + this.props.name}>
        <p>
          {categorySpan}
          <span style={{ fontWeight: 'bold' }}>{this.props.name}</span>
        </p>
        {descParagraph}
        {this.props.children}
      </section>
    );
  }
}

class PanelSelection extends React.Component<
  { settingItem: string | number; options: Array<string | number>; setSettings: (option: string | number) => void },
  {}
> {
  render(): JSX.Element {
    const selectOptions = this.props.options.map((option) => {
      return { value: option, label: option };
    });

    return (
      <Select
        className="settingPanelSelect"
        isSearchable={false}
        options={selectOptions}
        onChange={(value) => {
          if (value) {
            this.props.setSettings(value.value);
          }
        }}
        styles={customSelectStyles}
        theme={customSelectTheme}
        value={{
          value: this.props.settingItem,
          label: this.props.settingItem,
        }}
      />
    );
  }
}

class PanelNumberInput extends React.Component<
  { value: number; maximum: number; minimum: number; default: number; updateSettings: (newVal: number) => void },
  { value: string; info: string | undefined }
> {
  state = { value: '', info: undefined };

  componentDidMount() {
    this.setState({ value: this.props.value + '' });
  }

  render(): JSX.Element {
    return (
      <div className="panelInputWrapper">
        <input
          type="text"
          className="shortInput"
          spellCheck="false"
          value={this.state.value}
          onChange={(event) => {
            const re = /^((\d+)?(\.)?(\d+)?)?$/;
            if (re.test(event.target.value)) {
              this.setState({ value: event.target.value });
              const newVal = parseFloat(event.target.value);
              if (isNaN(newVal)) {
                this.setState({ info: undefined });
                this.props.updateSettings(this.props.default);
              } else if (newVal > this.props.maximum) {
                this.setState({ info: 'Value must be less than or equal to ' + this.props.maximum });
              } else if (newVal < this.props.minimum) {
                this.setState({ info: 'Value must be greater than or equal to ' + this.props.minimum });
              } else {
                this.setState({ info: undefined });
                this.props.updateSettings(newVal);
              }
            }
          }}
        />
        {this.state.info ? <label>{this.state.info}</label> : undefined}
      </div>
    );
  }
}

class PanelColorInput extends React.Component<
  { value: string; updateSettings: (newColor: string) => void },
  { value: string; info: string | undefined }
> {
  state = { value: '', info: undefined };

  componentDidMount() {
    this.setState({ value: this.props.value });
  }

  render(): JSX.Element {
    const colorTester = new Option().style;

    return (
      <div className="panelInputWrapper">
        <input
          type="text"
          className="longInput"
          spellCheck="false"
          value={this.state.value}
          onChange={(event) => {
            const newColor = event.target.value;
            this.setState({ value: newColor });
            colorTester.color = newColor;
            if (newColor === '') {
              this.setState({ info: undefined });
              this.props.updateSettings('');
            } else if (colorTester.color === '') {
              this.setState({ info: 'Invalid color style.' });
            } else {
              this.setState({ info: undefined });
              this.props.updateSettings(newColor);
            }
          }}
        />
        {this.state.info ? <label>{this.state.info}</label> : undefined}
      </div>
    );
  }
}

class DialogSettings extends React.Component<{ closeDialog: () => void }, { tab: string; settings: SettingsListType }> {
  state = { tab: 'General', settings: defaultSettings };

  static contextType = DialogContext;
  context!: React.ContextType<typeof DialogContext>;

  async componentDidMount() {
    this.setState({ settings: await ipcRenderer.invoke('getSettings') });
  }

  handleTabClick(newTab: string): void {
    this.setState({ tab: newTab });
  }

  renderGeneral(): JSX.Element {
    return <div></div>;
  }

  renderAppearance(): JSX.Element {
    return (
      <div className="settingsPanel innerScrollList">
        <PanelSection category="Background" name="Type" desc="Controls the type of background.">
          <PanelSelection
            settingItem={this.state.settings.backgroundType}
            options={['color', 'image', 'folder']}
            setSettings={(value: string | number) => {
              if (value === 'color' || value === 'image' || value === 'folder') {
                let newSettings = this.state.settings;
                newSettings.backgroundType = value;
                this.setState({ settings: newSettings });
              }
            }}
          />
        </PanelSection>

        <PanelSection category="Background" name="Value" desc="Controls the type of background.">
          <input
            type="text"
            className="longInput"
            spellCheck="false"
            value={this.state.settings.backgroundValue}
            onChange={(event) => {
              let newSettings = this.state.settings;
              newSettings.backgroundValue = event.target.value;
              this.setState({ settings: newSettings });
            }}
          />
        </PanelSection>

        <PanelSection category="Background" name="Opacity" desc="Controls the opacity of background (0-1).">
          <PanelNumberInput
            value={this.state.settings.backgroundOpacity}
            maximum={1}
            minimum={0}
            default={defaultSettings.backgroundOpacity}
            updateSettings={(newVal: number) => {
              let newSettings = this.state.settings;
              newSettings.backgroundOpacity = newVal;
              this.setState({ settings: newSettings });
            }}
          />
        </PanelSection>
      </div>
    );
  }

  renderNavigator(): JSX.Element {
    return (
      <div className="settingsPanel innerScrollList">
        <PanelSection
          category="Navigator"
          name="Width"
          desc="Controls the width of the navigator as a percentage of the window.">
          <PanelNumberInput
            value={this.state.settings.navigatorWidth}
            minimum={0}
            maximum={100}
            default={defaultSettings.navigatorWidth}
            updateSettings={(newVal: number) => {
              let newSettings = this.state.settings;
              newSettings.navigatorWidth = newVal;
              this.setState({ settings: newSettings });
            }}
          />
        </PanelSection>

        <PanelSection
          category="Title"
          name="Font Size"
          desc="Controls the font size of the title of the navigator (px).">
          <PanelNumberInput
            value={this.state.settings.navigatorTitleFontSize}
            minimum={6}
            maximum={100}
            default={defaultSettings.navigatorTitleFontSize}
            updateSettings={(newVal: number) => {
              let newSettings = this.state.settings;
              newSettings.navigatorTitleFontSize = newVal;
              this.setState({ settings: newSettings });
            }}
          />
        </PanelSection>

        <PanelSection
          category="Navigator"
          name="Draggable"
          desc="Controls the drag functionality of the navigator."
          checkbox={{
            value: this.state.settings.navigatorDraggable,
            onClick: () => {
              let newSettings = this.state.settings;
              newSettings.navigatorDraggable = !this.state.settings.navigatorDraggable;
              this.setState({ settings: newSettings });
            },
          }}
        />

        <PanelSection category="Navigator" name="Font Size" desc="Controls the font size of the navigator (px).">
          <PanelNumberInput
            value={this.state.settings.navigatorFontSize}
            minimum={6}
            maximum={100}
            default={defaultSettings.navigatorFontSize}
            updateSettings={(newVal: number) => {
              let newSettings = this.state.settings;
              newSettings.navigatorFontSize = newVal;
              this.setState({ settings: newSettings });
            }}
          />
        </PanelSection>

        <PanelSection
          category="Navigator"
          name="Font Color"
          desc="Controls the font color of the navigator. Input is in the form of a valid css color (e.g., Hex or rgba). If not set, this defaults to black.">
          <PanelColorInput
            value={this.state.settings.navigatorColor}
            updateSettings={(newColor: string) => {
              let newSettings = this.state.settings;
              newSettings.navigatorColor = newColor;
              this.setState({ settings: newSettings });
            }}
          />
        </PanelSection>

        <PanelSection
          category="Navigator"
          name="One Line Text"
          desc="Controls the maximum lines of anime entries in the navigator."
          checkbox={{
            value: this.state.settings.navigatorOneLineText,
            onClick: () => {
              let newSettings = this.state.settings;
              newSettings.navigatorOneLineText = !this.state.settings.navigatorOneLineText;
              this.setState({ settings: newSettings });
            },
          }}
        />
      </div>
    );
  }

  renderMetadata(): JSX.Element {
    return (
      <div className="settingsPanel innerScrollList">
        <PanelSection
          category="Introduction"
          name="Text Indent"
          desc="Controls the text indent of the paragraphs in introduction.">
          <PanelNumberInput
            value={this.state.settings.metadataDescTextIndent}
            maximum={10}
            minimum={0}
            default={defaultSettings.metadataDescTextIndent}
            updateSettings={(newVal: number) => {
              let newSettings = this.state.settings;
              newSettings.metadataDescTextIndent = newVal;
              this.setState({ settings: newSettings });
            }}
          />
        </PanelSection>
      </div>
    );
  }

  renderVideo(): JSX.Element {
    return (
      <div className="settingsPanel innerScrollList">
        <PanelSection category="Title" name="Font Size" desc="Controls the font size of the title (px).">
          <PanelNumberInput
            value={this.state.settings.videoTitleFontSize}
            minimum={6}
            maximum={100}
            default={defaultSettings.videoTitleFontSize}
            updateSettings={(newVal: number) => {
              let newSettings = this.state.settings;
              newSettings.videoTitleFontSize = newVal;
              this.setState({ settings: newSettings });
            }}
          />
        </PanelSection>

        <PanelSection
          category="Title"
          name="Font Color"
          desc="Controls the font color of the navigator. Input is in the form of a valid css color (e.g., Hex or rgba). If not set, this defaults to black.">
          <PanelColorInput
            value={this.state.settings.videoTitleColor}
            updateSettings={(newColor: string) => {
              let newSettings = this.state.settings;
              newSettings.videoTitleColor = newColor;
              this.setState({ settings: newSettings });
            }}
          />
        </PanelSection>

        <PanelSection
          category="Section"
          name="Layout"
          desc="Controls the layout style of episode panels in video sections.">
          <PanelSelection
            settingItem={this.state.settings.videoSectionLayout}
            options={['list', 'grid']}
            setSettings={(value: string | number) => {
              if (value === 'list' || value === 'grid') {
                let newSettings = this.state.settings;
                newSettings.videoSectionLayout = value;
                this.setState({ settings: newSettings });
              }
            }}
          />
        </PanelSection>

        <PanelSection
          category="Snapshot"
          name="Timestamp"
          desc="Controls the default frame of snapshot taken for each episode.">
          <PanelSelection
            settingItem={this.state.settings.videoSnapshotTimestamp}
            options={['first', 'last', 'random']}
            setSettings={(value: string | number) => {
              if (value === 'first' || value === 'last' || value === 'random') {
                let newSettings = this.state.settings;
                newSettings.videoSnapshotTimestamp = value;
                this.setState({ settings: newSettings });
              }
            }}
          />
        </PanelSection>
      </div>
    );
  }

  renderPanel(): JSX.Element {
    switch (this.state.tab) {
      case 'General':
        return this.renderGeneral();
      case 'Appearance':
        return this.renderAppearance();
      case 'Navigator':
        return this.renderNavigator();
      case 'Metadata':
        return this.renderMetadata();
      case 'Video':
        return this.renderVideo();
      default:
        break;
    }
    return this.renderGeneral();
  }

  handleOKClick() {
    ipcRenderer.send('updateSettings', this.state.settings);
    this.context.closeDialog();
  }

  render(): JSX.Element {
    const navTab = settingsTab.map((tab) => {
      const isSelected: boolean = tab === this.state.tab;
      return (
        <li
          key={tab}
          className="pointerCursor unselectable"
          style={isSelected ? { backgroundColor: 'pink' } : undefined}
          onClick={
            isSelected
              ? undefined
              : () => {
                  this.handleTabClick(tab);
                }
          }>
          {tab}
        </li>
      );
    });
    return (
      <div className="dialog dialogSettings">
        <ul className="dialogSettingsNav">
          {navTab}
          <li
            className="pointerCursor unselectable"
            style={{ marginTop: 'auto', borderTop: 'thin solid lightgrey' }}
            onClick={() => this.handleOKClick()}>
            OK
          </li>
          <li
            className="pointerCursor unselectable"
            style={{ borderBottom: 'none' }}
            onClick={() => this.props.closeDialog()}>
            Cancel
          </li>
        </ul>
        {this.renderPanel()}
      </div>
    );
  }
}

class DialogSortList extends React.Component<
  { info: Array<string>; closeDialog: () => void },
  { dirname: string; entryList: Array<string>; indexList: Array<number> }
> {
  state = { dirname: '', entryList: [], indexList: [] };

  componentDidMount() {
    const indexList = Array.from({ length: this.props.info.length - 1 }, (_element, index) => index);
    this.setState({ dirname: this.props.info[0], entryList: this.props.info.slice(1), indexList: indexList });
    document.addEventListener('keydown', this.handleEnterDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleEnterDown);
  }

  handleEnterDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) {
      return;
    } else if (event.key === 'Enter') {
      this.handleClickOK();
    }
  };

  handleClickOK() {
    ipcRenderer.send('updateAnimeVideoSectionOrder', this.state.dirname, this.state.indexList);
    this.props.closeDialog();
  }

  onDragEnd = (result: any) => {
    if (!result.destination) return;
    let newEntryList = this.state.entryList;
    let newIndexList = this.state.indexList;
    const [removedEntry] = newEntryList.splice(result.source.index, 1);
    const [removedIndex] = newIndexList.splice(result.source.index, 1);
    newEntryList.splice(result.destination.index, 0, removedEntry);
    newIndexList.splice(result.destination.index, 0, removedIndex);

    this.setState({ entryList: newEntryList, indexList: newIndexList });
  };

  render() {
    return (
      <div>
        <DragDropContext onDragEnd={this.onDragEnd}>
          <Droppable droppableId="characters">
            {(provided, _snapshot) => (
              <ul {...provided.droppableProps} ref={provided.innerRef} className="innerScrollList">
                {this.state.entryList.map((entry: string, index: number) => (
                  <Draggable key={entry} draggableId={entry} index={index}>
                    {(provided, _snapshot) => (
                      <li
                        className="pointerCursor"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}>
                        <p className="twoLineText unselectable">{entry}</p>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
        <div className="rowWrapper">
          <div>Videos: {this.state.entryList.length}</div>
          <button className="buttonOK" onClick={() => this.handleClickOK()}>
            OK
          </button>
        </div>
      </div>
    );
  }
}

class Dialog extends React.Component<{}, { result: string; checked: boolean }> {
  state = { result: '', checked: false };

  static contextType = DialogContext;
  context!: React.ContextType<typeof DialogContext>;

  componentDidMount() {
    if (
      this.context.mode !== 'sortList' &&
      this.context.mode !== 'promptTextarea' &&
      this.context.mode !== 'settings'
    ) {
      document.addEventListener('keydown', this.handleEnterDown);
    }
    document.addEventListener('keydown', this.handleEscDown);
    this.setState({ result: this.context.options.value });
    if (this.context.options.checked) {
      this.setState({ checked: true });
    }
  }

  componentWillUnmount() {
    if (
      this.context.mode !== 'sortList' &&
      this.context.mode !== 'promptTextarea' &&
      this.context.mode !== 'settings'
    ) {
      document.removeEventListener('keydown', this.handleEnterDown);
    }
    document.removeEventListener('keydown', this.handleEscDown);
  }

  handleEscDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) {
      return;
    } else if (event.key === 'Escape') {
      this.context.closeDialog();
    }
  };

  handleEnterDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) {
      return;
    } else if (event.key === 'Enter') {
      this.handleClickOK();
    }
  };

  handleSelectOptionClick(bangumiID: string) {
    this.setState({ result: bangumiID });
  }

  async handleClickOK(): Promise<void> {
    let options = this.context.options;
    switch (options.type) {
      case 'title':
        if (options.value !== this.state.result) {
          ipcRenderer.send('updateAnimeTitle', options.value, this.state.result);
        }
        break;
      case 'deleteAnimeEntry':
        ipcRenderer.send('deleteAnimeEntry', options.value, this.state.checked);
        break;
      case 'videoSectionTitle':
        if (options.info?.length === 1 && options.value !== this.state.result) {
          ipcRenderer.send('updateAnimeVideoSectionTitle', options.info[0], this.state.result);
        }
        break;
      case 'episodeInfo':
        if (options.info?.length === 2) {
          ipcRenderer.send('updateAnimeVideoEpisodeInfo', options.info[1], options.info[0], this.state.result);
        }
        break;
      case 'videoSnapshot':
        if (options.info?.length === 1) {
          await ipcRenderer.invoke('getVideoSnapshotPath', options.info[0], this.state.result);
        }
        break;
      case 'fetchMetadataByID':
        ipcRenderer.send('fetchMetadataByID', this.state.result);
        break;
      case 'fetchMetadataByName':
        ipcRenderer.send('fetchMetadataByName', this.state.result);
        break;
      case 'bangumiEntrySelection':
        ipcRenderer.send('fetchMetadataByID', this.state.result);
        break;
      case 'fetchEpisodeData':
        if (options.info?.length === 1) {
          ipcRenderer.send('fetchEpisodeData', this.state.result, options.info[0]);
        }
        break;

      default:
        break;
    }

    this.context.closeDialog();
  }

  disableEvent(event: React.MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  renderPrompt(): JSX.Element {
    return (
      <div className="dialog dialogPrompt" onClick={(event) => this.disableEvent(event)}>
        <img src={iconImage} />
        <p>{this.context.options.msg}</p>
        {this.context.mode === 'promptTextarea' ? (
          <textarea
            className="innerScrollList"
            autoFocus
            value={this.state.result}
            onChange={(event) => {
              this.setState({ result: event.target.value });
            }}></textarea>
        ) : (
          <input
            type="text"
            autoFocus
            spellCheck="false"
            value={this.state.result}
            onChange={(event) => {
              this.setState({ result: event.target.value });
            }}></input>
        )}
        <div className="dialogControl rowWrapper">
          <button className="buttonCancel" onClick={() => this.context.closeDialog()}>
            Cancel
          </button>
          <button className="buttonOK" onClick={() => this.handleClickOK()}>
            OK
          </button>
        </div>
      </div>
    );
  }

  renderError(): JSX.Element {
    return (
      <div className="dialog dialogError" onClick={(event) => this.disableEvent(event)}>
        <img src={iconImage} />
        <p className="dialogMessage">{this.context.options.value}</p>
        <button className="buttonOK" onClick={() => this.context.closeDialog()}>
          OK
        </button>
      </div>
    );
  }

  renderQuestion(): JSX.Element {
    return (
      <div className="dialog dialogError" onClick={(event) => this.disableEvent(event)}>
        <img src={iconImage} />
        <p className="dialogMessage">{this.context.options.msg}</p>
        <button className="buttonOK" onClick={() => this.handleClickOK()}>
          OK
        </button>
        <button className="buttonCancel" onClick={() => this.context.closeDialog()}>
          Cancel
        </button>
        {this.context.options.checked ? (
          <div
            className="checkboxWrapper unselectable"
            onClick={() => {
              const newVal = !this.state.checked;
              this.setState({ checked: newVal });
            }}>
            <label className={(this.state.checked ? 'checkboxChecked ' : '') + 'pointerCursor'} />
            <p className="pointerCursor">{this.context.options.checkMsg}</p>
          </div>
        ) : undefined}
      </div>
    );
  }

  renderSelectList(): JSX.Element {
    let selectOptions: Array<JSX.Element> = [];
    const animeInfo = this.context.options.info;
    if (animeInfo) {
      for (let index = 0; index < animeInfo.length; index += 4) {
        selectOptions.push(
          <li
            className="pointerCursor"
            style={this.state.result === animeInfo[index] ? { backgroundColor: 'pink' } : undefined}
            key={index}
            onClick={() => this.handleSelectOptionClick(animeInfo[index])}>
            <img src={animeInfo[index + 3]} />
            <section>
              <p className="oneLineText">{animeInfo[index + 1]}</p>
              <p className="oneLineText">{animeInfo[index + 2]}</p>
            </section>
          </li>
        );
      }
    }

    return (
      <div className="dialog dialogSelectList">
        <ul className="innerScrollList">{selectOptions}</ul>
        <div className="dialogControl rowWrapper">
          <button className="buttonCancel" onClick={() => this.context.closeDialog()}>
            Cancel
          </button>
          <button className="buttonOK" onClick={() => this.handleClickOK()}>
            OK
          </button>
        </div>
      </div>
    );
  }

  render(): JSX.Element {
    let dialog: JSX.Element = <div />;

    if (this.context.mode === 'hide') {
      return dialog;
    }

    if (this.context.mode === 'prompt' || this.context.mode === 'promptTextarea') {
      dialog = this.renderPrompt();
    } else if (this.context.mode === 'error') {
      dialog = this.renderError();
    } else if (this.context.mode === 'question') {
      dialog = this.renderQuestion();
    } else if (this.context.mode === 'selectList') {
      dialog = this.renderSelectList();
    } else if (this.context.mode === 'sortList' && this.context.options.info) {
      dialog = (
        <div className="dialog dialogSortList">
          <div className="rowWrapper">
            <img src={iconImage} />
            <h3>{this.context.options.value}</h3>
          </div>
          <DialogSortList info={this.context.options.info} closeDialog={this.context.closeDialog} />
        </div>
      );
    } else if (this.context.mode === 'settings') {
      dialog = <DialogSettings closeDialog={this.context.closeDialog} />;
    }

    return (
      <div className={'dialogMask open'}>
        <div className="dialogWrapper">{dialog}</div>
      </div>
    );
  }
}

export const DialogProvider: React.FC<React.ReactNode> = ({ children }) => {
  const [mode, setMode] = React.useState<DialogModeType>('hide');
  const [options, setOptions] = React.useState<updateOptionType>({ type: '', value: '' });
  const [settings, setSettings] = React.useState<SettingsListType>(defaultSettings);

  const openDialog = (mode: DialogModeType, options: updateOptionType) => {
    setOptions(options);
    setMode(mode);
  };

  const closeDialog = () => {
    setOptions({ type: '', value: '', info: [] });
    setMode('hide');
  };

  const updateSettings = (newSettings: SettingsListType) => {
    setSettings(newSettings);
  };

  return (
    <DialogContext.Provider value={{ mode, options, settings, openDialog, closeDialog, updateSettings }}>
      {children}
      {mode === 'hide' ? undefined : <Dialog />}
    </DialogContext.Provider>
  );
};
