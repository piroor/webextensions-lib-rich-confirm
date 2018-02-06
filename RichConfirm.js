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
    this.onKeyPress = this.onKeyPress.bind(this);
  }
  RichConfirm.prototype = {
    uniqueKey: parseInt(Math.random() * Math.pow(2, 16)),
    get dialog() {
      return this.ui.querySelector(`.rich-confirm-dialog${this.uniqueKey}`);
    },
    get message() {
      return this.ui.querySelector(`.rich-confirm-message${this.uniqueKey}`);
    },
    get buttonsContainer() {
      return this.ui.querySelector(`.rich-confirm-buttons${this.uniqueKey}`);
    },
    get checkContainer() {
      return this.ui.querySelector(`.rich-confirm-check-label${this.uniqueKey}`);
    },
    get checkCheckbox() {
      return this.ui.querySelector(`.rich-confirm-check-checkbox${this.uniqueKey}`);
    },
    get checkMessage() {
      return this.ui.querySelector(`.rich-confirm-check-message${this.uniqueKey}`);
    },

    buildUI() {
      this.style = document.createElement('style');
      this.style.setAttribute('type', 'text/css');
      this.style.textContent = `
        .rich-confirm${this.uniqueKey},
        .rich-confirm-row${this.uniqueKey} {
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

        .rich-confirm${this.uniqueKey} {
          background: rgba(0, 0, 0, 0.45);
          left:0;
          opacity: 0;
          pointer-events: none;
          transition: opacity 250ms ease-out;
          z-index: 999997;
        }

        .rich-confirm${this.uniqueKey}.show {
          opacity: 1;
          pointer-events: auto;
        }

        .rich-confirm-row${this.uniqueKey} {
          z-index: 999998;
        }

        .rich-confirm-dialog${this.uniqueKey} {
          background: -moz-dialog;
          border-radius: 0.5em;
          box-shadow: 0.1em 0.1em 0.5em rgba(0, 0, 0, 0.65);
          color: -moz-dialogtext;
          margin: 0.5em;
          max-width: 20em;
          padding: 1em;
          z-index: 999999;
        }

        .rich-confirm-buttons${this.uniqueKey} {
          align-items: stretch;
          flex-direction: column;
          justify-content: center;
          margin: 0.5em 0 0;
        }

        .rich-confirm-buttons${this.uniqueKey} button {
          background: ButtonFace;
          border: 1px solid ThreeDShadow;
          border-radius: 0;
          color: ButtonText;
          display: block;
          margin-bottom: 0.2em;
          width: 100%;
        }
        .rich-confirm-buttons${this.uniqueKey} button:focus {
          background: Highlight;
          color: HighlightText;
        }
        .rich-confirm-buttons${this.uniqueKey} button:focus::-moz-focus-inner {
          border: none;
        }

        .rich-confirm-buttons${this.uniqueKey} button:hover {
          background: ActiveCaption;
          color: CaptionText;
        }

        .rich-confirm-check-label${this.uniqueKey} {
          display: flex;
          flex-direction: row;
          margin-top: 0.5em;
        }

        .rich-confirm-check-label${this.uniqueKey}.hidden {
          display: none;
        }
      `;
      document.head.appendChild(this.style);

      var range = document.createRange();
      range.selectNodeContents(document.body);
      range.collapse(false);
      var fragment = range.createContextualFragment(`
        <div class="rich-confirm${this.uniqueKey}">
          <div class="rich-confirm-row${this.uniqueKey}">
            <div class="rich-confirm-dialog${this.uniqueKey}">
              <span class="rich-confirm-message${this.uniqueKey}"></span>
              <div class="rich-confirm-buttons${this.uniqueKey}"></div>
              <label class="rich-confirm-check-label${this.uniqueKey}">
                <input type="checkbox"
                       class="rich-confirm-check-checkbox${this.uniqueKey}">
                <span class="rich-confirm-check-message${this.uniqueKey}"></span>
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

      var range = document.createRange();
      range.selectNodeContents(this.buttonsContainer);
      range.deleteContents();
      var buttons = document.createDocumentFragment();
      for (let label of this.params.buttons) {
        let button = document.createElement('button');
        button.textContent = label;
        button.setAttribute('title', label);
        buttons.appendChild(button);
      }
      range.insertNode(buttons);
      range.detach();

      this.ui.addEventListener('click', this.onClick);
      window.addEventListener('keypress', this.onKeyPress, true);
      this.ui.classList.add('show');

      this.buttonsContainer.firstChild.focus();

      return new Promise((aResolve, aReject) => {
        this._resolve = aResolve;
        this._rejecte = aReject;
      });
    },

    hide() {
      this.ui.removeEventListener('click', this.onClick);
      window.removeEventListener('keypress', this.onKeyPress, true);
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

      var button = aEvent.target.closest('button');
      if (button) {
        aEvent.stopPropagation();
        aEvent.preventDefault();
        let buttonIndex = Array.slice(this.buttonsContainer.childNodes).indexOf(button);
        this._resolve({
          buttonIndex,
          checked: !!this.params.message && this.checkCheckbox.checked
        });
        this.hide();
        return;
      }

      if (!aEvent.target.closest(`.rich-confirm-dialog${this.uniqueKey}`)) {
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.dismiss();
      }
    },

    onKeyPress(aEvent) {
      switch (aEvent.keyCode) {
        case aEvent.DOM_VK_UP:
        case aEvent.DOM_VK_LEFT:
        case aEvent.DOM_VK_PAGE_UP:
          aEvent.stopPropagation();
          aEvent.preventDefault();
          this.advanceFocus(-1);
          break;

        case aEvent.DOM_VK_DOWN:
        case aEvent.DOM_VK_RIGHT:
        case aEvent.DOM_VK_PAGE_DOWN:
          aEvent.stopPropagation();
          aEvent.preventDefault();
          this.advanceFocus(1);
          break;

        case aEvent.DOM_VK_TAB:
          aEvent.stopPropagation();
          aEvent.preventDefault();
          this.advanceFocus(aEvent.shiftKey ? -1 : 1);
          break;

        case aEvent.DOM_VK_ESCAPE:
          aEvent.stopPropagation();
          aEvent.preventDefault();
          this.dismiss();
          break;

        default:
          return;
      }
    },

    advanceFocus(aDirection) {
      const focusedButton = this.buttonsContainer.querySelector(':focus');
      console.log('focusedButton ', focusedButton);
      if (aDirection < 0) { // backward
        if (!focusedButton)
          this.buttonsContainer.lastChild.focus();
        else
          (focusedButton.previousSibling || this.checkCheckbox).focus();
      }
      else { // forward
        if (!focusedButton)
          this.buttonsContainer.firstChild.focus();
        else
          (focusedButton.nextSibling || this.checkCheckbox).focus();
      }
    }
  };
  RichConfirm.show = async function(aParams) {
    const confirm = new this(aParams);
    return confirm.show();
  };
  RichConfirm.showInTab = async function(aTabId, aParams) {
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
  };
  window.RichConfirm = RichConfirm;
  return true; // this is required to run this script as a content script
})();
