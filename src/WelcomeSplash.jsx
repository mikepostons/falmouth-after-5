import React from "react";
import "./welcome-splash.css";

export default function WelcomeSplash({ mapReady, departing }) {
  return (
    <div className={`welcome-splash ${mapReady ? "map-ready" : ""} ${departing ? "is-departing" : ""}`} aria-label="Welcome to Falmouth After Five">
      <div className="splash-logo" aria-hidden="true">
        <img className="splash-wordmark" src="./assets/splash-wordmark.svg" alt="" />
        <div className="splash-circle">
          <img src="./assets/splash-circle.svg" alt="" />
          <svg className="splash-dial" viewBox="0 0 120 120">
            <circle className="splash-dial-track" cx="60" cy="60" r="57" />
            <circle className="splash-dial-progress" cx="60" cy="60" r="57" pathLength="1" />
          </svg>
        </div>
      </div>
      <a className="splash-credit" href="https://3deepmedia.com/" target="_blank" rel="noopener noreferrer" aria-label="Developed by 3deep Media (opens in a new tab)">
        <img src="./assets/logo-3deep.png" alt="Developed by 3deep Media" />
      </a>
    </div>
  );
}
