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

  applySettings(newSettings: SettingsListType) {
    this.context.updateSettings(newSettings);

    if (newSettings.themeColor === '') newSettings.themeColor = 'pink';
    // set theme color
    document.documentElement.style.setProperty('--theme-color', newSettings.themeColor);
    // set theme color variants
    let fakeDiv = document.createElement('div');
    fakeDiv.style.color = newSettings.themeColor;
    document.body.appendChild(fakeDiv);
    const computedColor = window.getComputedStyle(fakeDiv).getPropertyValue('color');
    document.body.removeChild(fakeDiv);

    const isRGBA = computedColor.substr(0, 4) === 'rgba';
    const rgb = computedColor
      .substr(isRGBA ? 5 : 4)
      .split(')')[0]
      .split(',')
      .map((str) => parseFloat(str));
    const colorPrefix = isRGBA ? 'rgba(' : 'rgb(';
    const colorSuffix = isRGBA ? ', ' + rgb[3] + ')' : ')';
    const R75 = (255 - rgb[0]) * 0.25 + rgb[0];
    const G75 = (255 - rgb[1]) * 0.25 + rgb[1];
    const B75 = (255 - rgb[2]) * 0.25 + rgb[2];
    document.documentElement.style.setProperty(
      '--theme-color75',
      colorPrefix + R75 + ', ' + G75 + ', ' + B75 + colorSuffix
    );
    const R50 = (255 - rgb[0]) * 0.5 + rgb[0];
    const G50 = (255 - rgb[1]) * 0.5 + rgb[1];
    const B50 = (255 - rgb[2]) * 0.5 + rgb[2];
    document.documentElement.style.setProperty(
      '--theme-color50',
      colorPrefix + R50 + ', ' + G50 + ', ' + B50 + colorSuffix
    );
    const R25 = (255 - rgb[0]) * 0.75 + rgb[0];
    const G25 = (255 - rgb[1]) * 0.75 + rgb[1];
    const B25 = (255 - rgb[2]) * 0.75 + rgb[2];
    document.documentElement.style.setProperty(
      '--theme-color25',
      colorPrefix + R25 + ', ' + G25 + ', ' + B25 + colorSuffix
    );
  }

  async componentDidMount() {
    if (this.backgroundProvider.current) {
      this.backgroundProvider.current.style.backgroundImage = await ipcRenderer.invoke('getBackgroundImage');
    }

    this.applySettings(await ipcRenderer.invoke('getSettings'));

    ipcRenderer.on('updateSettings', this.updateSettings);
    ipcRenderer.on('updateBackground', this.updateBackground);
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('updateSettings', this.updateSettings);
    ipcRenderer.removeListener('updateBackground', this.updateBackground);
  }

  updateSettings = (_event: Electron.IpcRendererEvent, newSettings: SettingsListType) => {
    this.applySettings(newSettings);
  };

  updateBackground = (_event: Electron.IpcRendererEvent, backgroundCSS: string) => {
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
