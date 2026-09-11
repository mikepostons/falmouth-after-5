import React, { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import BusinessSubmission from "./BusinessSubmission";

export default function ExplorerMenu({ onClose, onPrivacy, data, MapView }) {
  const dialog = useRef(null);
  const backdropPointer = useRef(false);
  const [page, setPage] = useState("menu");
  const [dirty, setDirty] = useState(false);
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const discardPrompt = useRef(null);
  const [pendingExit, setPendingExit] = useState(null);
  const exit = (destination) => {
    if (submissionBusy) return;
    if (dirty) { setPendingExit(destination); return; }
    if (destination === 'close') onClose(); else setPage('menu');
  };
  useEffect(() => {
    if (pendingExit) {
      dialog.current?.querySelector('.explorer-menu-inner')?.scrollTo({top:0});
      discardPrompt.current?.querySelector('button')?.focus();
    }
  }, [pendingExit]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    const prior = document.activeElement;
    dialog.current.showModal();
    return () => prior?.focus();
  }, []);
  useEffect(() => {
    const inner = dialog.current?.querySelector(".explorer-menu-inner");
    if (inner) inner.scrollTop = 0;
    const heading = dialog.current?.querySelector("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, [page]);
  return (
    <dialog
      ref={dialog}
      className={`explorer-menu ${page === "submit" ? "is-submission" : ""}`}
      aria-label={
        page === "submit"
          ? "Add your business"
          : page === "information"
            ? "Information"
            : "Menu"
      }
      onCancel={(e) => {
        e.preventDefault();
        exit("close");
      }}
      onPointerDown={e => { backdropPointer.current = e.target === dialog.current; }}
      onClick={(e) => {
        if (backdropPointer.current && e.target === dialog.current) exit("close");
        backdropPointer.current = false;
      }}
    >
      <div className="explorer-menu-inner">
        <header className="explorer-menu-heading">
          {page !== "menu" ? (
            <button
              className="icon-button"
              disabled={submissionBusy}
              aria-label="Back to menu"
              onClick={() => exit("menu")}
            >
              <Icon name="back" />
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          <button
            className="icon-button"
            disabled={submissionBusy}
            aria-label="Close menu"
            onClick={() => exit("close")}
          >
            <Icon name="close" />
          </button>
        </header>
        {pendingExit && <div ref={discardPrompt} className="submission-error-summary" role="alert">
          <strong>Discard this submission?</strong><p>Your unsent details and photos will be lost.</p>
          <div className="submission-navigation"><button className="button secondary" onClick={()=>setPendingExit(null)}>Keep editing</button><button className="button primary" onClick={()=>{setDirty(false);setPendingExit(null);if(pendingExit==='close')onClose();else setPage('menu');}}>Discard changes</button></div>
        </div>}
        {page === "menu" && (
          <>
            <nav
              className="explorer-menu-links"
              aria-label="Explore Falmouth After Five"
            >
              <button onClick={() => setPage("information")}>
                <span>
                  <strong>Information</strong>
                  <small>About Falmouth After Five</small>
                </span>
                <Icon name="right" />
              </button>
              <button onClick={() => setPage("submit")}>
                <span>
                  <strong>Add your business</strong>
                  <small>Take part in the next First Friday</small>
                </span>
                <Icon name="plus" />
              </button>
              <button
                onClick={() => {
                  onClose();
                  onPrivacy();
                }}
              >
                <span>
                  <strong>Privacy & cookies</strong>
                </span>
                <Icon name="right" />
              </button>
            </nav>
            <p className="menu-organiser">Organised by Falmouth BID</p>
          </>
        )}
        {page === "information" && (
          <section>
            <h1>A little more Falmouth.</h1>
            <p>
              Falmouth After Five brings local businesses together for First
              Friday offers. Discover somewhere new to eat, meet for a drink,
              shop locally and make an evening of the town.
            </p>
            <p>
              Browse the offers or explore the map. Select a business for its
              offer, conditions and directions. Check the selected campaign date
              and each venue’s offer times before visiting.
            </p>
            <p>The project is organised by Falmouth BID.  This map portal was developed by <a href="https://www.3deepmedia.com" target="_blank" rel="noopener noreferrer">3deep Media</a></p>
            <a
              className="button primary campaign-page-link"
              href="https://www.falmouth.co.uk/discover-falmouth/falmouth-after-5/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit the campaign page <Icon name="external" />
            </a>
          </section>
        )}
        {page === "submit" && (
          <section>
            <h1>Add your business</h1>
            <BusinessSubmission data={data} MapView={MapView} onClose={onClose} onDirty={setDirty} onBusy={setSubmissionBusy} />
          </section>
        )}
      </div>
    </dialog>
  );
}
