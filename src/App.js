import React, { Component } from 'react';
import logo from './logo.png';
import './App.css';

const electron = window.require('electron');
const ipcRenderer  = electron.ipcRenderer;

ipcRenderer.on('exit', function() {new App().toggle()});
ipcRenderer.on('user-catch', function (event, arg) {
    if(!arg.auth) return;
    document.getElementById("user").value = arg.auth.name;
    document.getElementById("user").disabled = true;
});

let toggled = false;

class App extends Component {
    constructor(props) {
        super(props);

        this.toggle = this.toggle.bind(this);
        this.processLogin = this.processLogin.bind(this);
        this.getUser = this.getUser.bind(this);
    }

    toggle() {
        if(!toggled) {
            toggled = true;
            document.getElementById("loader").style.display = "block";
        } else {
            toggled = false;
            document.getElementById("loader").style.display = "none";
        }
    }

    processLogin() {
        this.toggle();
        ipcRenderer.send('launch', document.getElementById('user').value);
    }

    getUser() {
        ipcRenderer.send('user-throw', null);
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
                  {this.getUser()}
                  <input id="user" />
                  <div>
                      <button onClick={this.processLogin}>Login</button>
                  </div>
              </div>
          </div>
        )
    }
}

export default App;
