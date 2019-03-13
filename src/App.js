import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

class App extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          Generative Music Sketch
        </header>
        <main>
          <div>
            Please wait while the music loads. (10 seconds or so)
          </div>
          <a href='./'>
            Refresh to hear a new atmosphere
          </a>
        </main>
      </div>
    );
  }
}

export default App;
