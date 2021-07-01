import React from 'react';
import { render } from 'react-dom';
import { Container } from './components/';
import { DialogProvider } from './components/dialog';
import './App.global.css';

export class App extends React.Component<{}, {}> {
  render(): JSX.Element {
    return (
      <DialogProvider>
        <Container />
      </DialogProvider>
    );
  }
}

render(<App />, document.getElementById('root'));
