/*
 license: The MIT License, Copyright (c) 2018 YUKI "Piro" Hiroshi
 original:
   https://github.com/piroor/webextensions-lib-rich-confirm
*/
'use strict';

(function defineRichConfirm() {
  const RichConfirm = function(aParams) {
    this.params = aParams;
    if (!this.params.buttons)
      this.params.buttons = ['OK'];
    this.onClick = this.onClick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onUnload = this.onUnload.bind(this);
  }
  RichConfirm.prototype = {
    uniqueKey: parseInt(Math.random() * Math.pow(2, 16)),
    get commonClass() {
      return `rich-confirm-${this.uniqueKey}`;
    },
    get dialog() {
      return this.ui.querySelector(`.rich-confirm-dialog`);
    },
    get message() {
      return this.ui.querySelector(`.rich-confirm-message`);
    },
    get buttonsContainer() {
      return this.ui.querySelector(`.rich-confirm-buttons`);
    },
    get checkContainer() {
      return this.ui.querySelector(`.rich-confirm-check-label`);
    },
    get checkCheckbox() {
      return this.ui.querySelector(`.rich-confirm-check-checkbox`);
    },
    get checkMessage() {
      return this.ui.querySelector(`.rich-confirm-check-message`);
    },

    buildUI() {
      this.style = document.createElement('style');
      this.style.setAttribute('type', 'text/css');
      const common = `.${this.commonClass}`;
      this.style.textContent = `
        ${common}.rich-confirm,
        ${common}.rich-confirm-row {
          align-items: center;
          bottom: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          left: 0;
          position: fixed;
          right: 0;
          top: 0;
        }

        ${common}.rich-confirm {
          background: rgba(0, 0, 0, 0.45);
          left:0;
          opacity: 0;
          pointer-events: none;
          transition: opacity 250ms ease-out;
          z-index: 999997;
        }

        ${common}.rich-confirm.show {
          opacity: 1;
          pointer-events: auto;
        }

        ${common}.rich-confirm-row {
          z-index: 999998;
        }

        ${common}.rich-confirm-dialog {
          background: -moz-dialog;
          box-shadow: 0.1em 0.1em 0.5em rgba(0, 0, 0, 0.65);
          color: -moz-dialogtext;
          font: message-box;
          margin: 0.5em;
          max-height: 90%;
          max-width: 90%;
          overflow: auto;
          padding: 1em;
          z-index: 999999;
        }

        ${common}.rich-confirm-buttons {
          align-items: stretch;
          flex-direction: column;
          justify-content: center;
          margin: 0.5em 0 0;
        }

        ${common}.rich-confirm-buttons button {
          background: ButtonFace;
          border: 1px solid ThreeDShadow;
          border-radius: 0;
          color: ButtonText;
          display: block;
          font: message-box;
          margin-bottom: 0.2em;
          padding: 0.4em;
          text-align: center;
          width: 100%;
        }
        ${common}.rich-confirm-buttons button:focus {
          border-color: Highlight;
        }
        ${common}.rich-confirm-buttons button:focus::-moz-focus-inner {
          border: none;
        }

        ${common}.rich-confirm-buttons button:hover {
          background: Highlight;
          border-color: ThreeDShadow;
          color: HighlightText;
        }

        ${common}.rich-confirm-check-label {
          display: flex;
          flex-direction: row;
          margin-top: 0.5em;
        }

        ${common}.rich-confirm-check-label.hidden {
          display: none;
        }
      `;
      document.head.appendChild(this.style);

      const range = document.createRange();
      range.selectNodeContents(document.body);
      range.collapse(false);
      const commonClass = this.commonClass;
      const fragment = range.createContextualFragment(`
        <div class="rich-confirm ${commonClass}">
          <div class="rich-confirm-row ${commonClass}">
            <div class="rich-confirm-dialog ${commonClass}">
              <span class="rich-confirm-message ${commonClass}"></span>
              <div class="rich-confirm-buttons ${commonClass}"></div>
              <label class="rich-confirm-check-label ${commonClass}">
                <input type="checkbox"
                       class="rich-confirm-check-checkbox ${commonClass}">
                <span class="rich-confirm-check-message ${commonClass}"></span>
              </label>
            </div>
          </div>
        </div>
      `);
      range.insertNode(fragment);
      range.detach();
      this.ui = document.body.lastElementChild;
    },

    show: async function() {
      this.buildUI();
      await new Promise((aResolve, aReject) => setTimeout(aResolve, 0));

      this.message.textContent = this.params.message;

      if (this.params.checkMessage) {
        this.checkMessage.textContent = this.params.checkMessage;
        this.checkCheckbox.checked = !!this.params.checked;
        this.checkContainer.classList.remove('hidden');
      }
      else {
        this.checkContainer.classList.add('hidden');
      }

      const range = document.createRange();
      range.selectNodeContents(this.buttonsContainer);
      range.deleteContents();
      const buttons = document.createDocumentFragment();
      for (const label of this.params.buttons) {
        const button = document.createElement('button');
        button.textContent = label;
        button.setAttribute('title', label);
        buttons.appendChild(button);
      }
      range.insertNode(buttons);
      range.detach();

      this.ui.addEventListener('click', this.onClick);
      window.addEventListener('keydown', this.onKeyDown, true);
      window.addEventListener('keyup', this.onKeyUp, true);
      window.addEventListener('pagehide', this.onUnload);
      window.addEventListener('beforeunload', this.onUnload);
      this.ui.classList.add('show');

      this.buttonsContainer.firstChild.focus();

      return new Promise((aResolve, aReject) => {
        this._resolve = aResolve;
        this._rejecte = aReject;
      });
    },

    hide() {
      this.ui.removeEventListener('click', this.onClick);
      window.removeEventListener('keydown', this.onKeyDown, true);
      window.removeEventListener('keyup', this.onKeyUp, true);
      window.removeEventListener('pagehide', this.onUnload);
      window.removeEventListener('beforeunload', this.onUnload);
      delete this._resolve;
      delete this._rejecte;
      this.ui.classList.remove('show');
      window.setTimeout(() => {
        this.ui.parentNode.removeChild(this.ui);
        this.style.parentNode.removeChild(this.style);
        delete this.ui;
        delete this.style;
      }, 1000);
    },

    dismiss() {
      this._resolve({
        buttonIndex: -1,
        checked: !!this.params.message && this.checkCheckbox.checked
      });
      this.hide();
    },

    onClick(aEvent) {
      if (aEvent.button != 0) {
        aEvent.stopPropagation();
        aEvent.preventDefault();
        return;
      }

      const button = aEvent.target.closest('button');
      if (button) {
        aEvent.stopPropagation();
        aEvent.preventDefault();
        const buttonIndex = Array.slice(this.buttonsContainer.childNodes).indexOf(button);
        this._resolve({
          buttonIndex,
          checked: !!this.params.message && this.checkCheckbox.checked
        });
        this.hide();
        return;
      }

      if (!aEvent.target.closest(`.rich-confirm-dialog.${this.commonClass}`)) {
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.dismiss();
      }
    },

    onKeyDown(aEvent) {
      switch (aEvent.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
        case 'PageUp':
          aEvent.stopPropagation();
          aEvent.preventDefault();
          this.advanceFocus(-1);
          break;

        case 'ArrowDown':
        case 'ArrowRight':
        case 'PageDown':
          aEvent.stopPropagation();
          aEvent.preventDefault();
          this.advanceFocus(1);
          break;

        case 'Home':
          aEvent.stopPropagation();
          aEvent.preventDefault();
          this.buttonsContainer.firstChild.focus();
          break;

        case 'End':
          aEvent.stopPropagation();
          aEvent.preventDefault();
          if (this.params.checkMessage)
            this.checkCheckbox.focus();
          else
            this.buttonsContainer.lastChild.focus();
          break;

        case 'Tab':
          aEvent.stopPropagation();
          aEvent.preventDefault();
          this.advanceFocus(aEvent.shiftKey ? -1 : 1);
          break;

        case 'Escape':
          aEvent.stopPropagation();
          aEvent.preventDefault();
          this.dismiss();
          break;

        default:
          return;
      }
    },

    onKeyUp(aEvent) {
      switch (aEvent.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
        case 'PageUp':
        case 'ArrowDown':
        case 'ArrowRight':
        case 'PageDown':
        case 'Home':
        case 'End':
        case 'Tab':
        case 'Escape':
          aEvent.stopPropagation();
          aEvent.preventDefault();
          break;

        default:
          return;
      }
    },

    onUnload() {
      this.dismiss();
    },

    advanceFocus(aDirection) {
      const focusedButton = this.buttonsContainer.querySelector(':focus');
      console.log('focusedButton ', focusedButton);
      if (aDirection < 0) { // backward
        if (focusedButton && focusedButton.previousSibling)
          focusedButton.previousSibling.focus();
        else if (this.params.checkMessage && !this.checkCheckbox.matches(':focus'))
          this.checkCheckbox.focus();
        else
          this.buttonsContainer.lastChild.focus();
      }
      else { // forward
        if (!focusedButton)
          this.buttonsContainer.firstChild.focus();
        else if (focusedButton.nextSibling)
          focusedButton.nextSibling.focus();
        else if (this.params.checkMessage)
          this.checkCheckbox.focus();
        else
          this.buttonsContainer.firstChild.focus();
      }
    }
  };
  RichConfirm.show = async function(aParams) {
    const confirm = new this(aParams);
    return confirm.show();
  };
  RichConfirm.showInTab = async function(aTabId, aParams) {
    if (!aParams) {
      aParams = aTabId;
      aTabId = await browser.tabs.getCurrent();
    }
    try {
      await browser.tabs.executeScript(aTabId, {
        code: `
          if (!window.RichConfirm)
             (${defineRichConfirm.toSource()})();
        `,
        matchAboutBlank: true,
        runAt:           'document_start'
      });
      browser.tabs.executeScript(aTabId, {
        code: `
        delete window.RichConfirm.result;
        (async () => {
          const confirm = new RichConfirm(${JSON.stringify(aParams)});
          window.RichConfirm.result = await confirm.show();
        })();
      `,
        matchAboutBlank: true,
        runAt:           'document_start'
      });
      let result;
      while (true) {
        const results = await browser.tabs.executeScript(aTabId, {
          code:            `window.RichConfirm.result`,
          matchAboutBlank: true,
          runAt:           'document_start'
        });
        if (results.length > 0 &&
          results[0] !== undefined) {
          result = results[0];
          break;
        }
        await new Promise((aResolve, aReject) => setTimeout(aResolve, 100));
      }
      return result;
    }
    catch(e) {
      return {
        buttonIndex: -1
      };
    }
  };
  window.RichConfirm = RichConfirm;
  return true; // this is required to run this script as a content script
})();
