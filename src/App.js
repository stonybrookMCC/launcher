import React, { Component } from 'react';
import logo from './logo.png';
import './App.css';

const electron = window.require('electron');
const ipcRenderer  = electron.ipcRenderer;


ipcRenderer.on('log', function (event, arg) {
    console.log(String.fromCharCode.apply(null, arg) || arg);
});

ipcRenderer.on('user-catch', function (event, arg) {
    if(!arg.auth) return;
    document.getElementById("user").style.display = "none";
    document.getElementById("title").style.marginTop = "20px";
    document.getElementById("title").innerText = `Logged in as: ${arg.auth.name}`;
});

let toggled = false;

class App extends Component {
    static toggle() {
        if(!toggled) {
            toggled = true;
            document.getElementById("loader").style.display = "block";
        } else {
            toggled = false;
            document.getElementById("loader").style.display = "none";
        }
    }

    static processLogin() {
        App.toggle();
        ipcRenderer.send('launch', document.getElementById('user').value);
    }

    static getUser() {
        ipcRenderer.send('user-throw', null);
    }

    static updateUser () {
        document.getElementById("user").style.display = "block";
        document.getElementById("title").style.marginTop = "0px";
        document.getElementById("title").innerText = "Please type your new username";
    }

    render() {
        return (
          <div className="App">
              <div id="loader">
                  <div>
                      Building Client...
                  </div>
              </div>
              <img src={logo}/>
              <div className="login">
                  <div id="title">Please type your username</div>
                  {App.getUser()}
                  <input id="user" />
                  <button id="changeUsername" onClick={App.updateUser}>Change Username</button>
                  <div>
                      <button id="login" onClick={App.processLogin}>Login</button>
                  </div>
              </div>
          </div>
        )
    }
}

export default App;
