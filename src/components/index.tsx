import React from 'react';
import { ipcRenderer } from 'electron';
import { LeftNav } from './leftnav';
import { AnimePanel } from './animepanel';
import { DialogContext } from './dialog';
import { SettingsListType } from '../types';

class Container extends React.Component<{}, {}> {
  backgroundProvider: React.RefObject<HTMLDivElement> = React.createRef();

  static contextType = DialogContext;
  context!: React.ContextType<typeof DialogContext>;

  async componentDidMount() {
    if (this.backgroundProvider.current) {
      this.backgroundProvider.current.style.backgroundImage = await ipcRenderer.invoke('getBackgroundImage');
    }

    ipcRenderer.on('updateSettings', this.updateSettings);
    this.context.updateSettings(await ipcRenderer.invoke('getSettings'));
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('updateSettings', this.updateSettings);
  }

  updateSettings = (_event: Electron.IpcRendererEvent, newSettings: SettingsListType, backgroundCSS: string) => {
    this.context.updateSettings(newSettings);
    if (this.backgroundProvider.current) {
      this.backgroundProvider.current.style.backgroundImage = backgroundCSS;
    }
  };

  render() {
    return (
      <div className="container">
        <LeftNav />
        <AnimePanel />
        <div
          className="backgroundProvider"
          style={{ opacity: this.context.settings.backgroundOpacity }}
          ref={this.backgroundProvider}
        />
      </div>
    );
  }
}

export { Container };
