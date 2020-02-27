/*
 license: The MIT License, Copyright (c) 2018 YUKI "Piro" Hiroshi
 original:
   https://github.com/piroor/webextensions-lib-rich-confirm
*/
'use strict';

(function defineRichConfirm() {
  class RichConfirm {
    constructor(params) {
      this.params = params;
      if (!this.params.buttons)
        this.params.buttons = ['OK'];
      this.onClick = this.onClick.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onKeyUp = this.onKeyUp.bind(this);
      this.onContextMenu = this.onContextMenu.bind(this);
      this.onUnload = this.onUnload.bind(this);
    }
    get commonClass() {
      return `rich-confirm-${this.uniqueKey}`;
    }
    get dialog() {
      return this.ui.querySelector('.rich-confirm-dialog');
    }
    get content() {
      return this.ui.querySelector('.rich-confirm-content');
    }
    get buttonsContainer() {
      return this.ui.querySelector('.rich-confirm-buttons');
    }
    get checkContainer() {
      return this.ui.querySelector('.rich-confirm-check-label');
    }
    get checkCheckbox() {
      return this.ui.querySelector('.rich-confirm-check-checkbox');
    }
    get checkMessage() {
      return this.ui.querySelector('.rich-confirm-check-message');
    }

    get focusTargets() {
      return Array.from(this.ui.querySelectorAll('input:not([type="hidden"]), textarea, select, button')).filter(node => node.offsetWidth > 0);
    }

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
              <div class="rich-confirm-content ${commonClass}"></div>
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
    }

    async show() {
      this.buildUI();
      await new Promise((resolve, _reject) => setTimeout(resolve, 0));

      const range = document.createRange();

      if (this.params.content) {
        range.selectNodeContents(this.content);
        range.collapse(false);
        const fragment = range.createContextualFragment(this.params.content);
        range.insertNode(fragment);
      }
      else if (this.params.message) {
        this.content.textContent = this.params.message;
      }

      if (this.params.checkMessage) {
        this.checkMessage.textContent = this.params.checkMessage;
        this.checkCheckbox.checked = !!this.params.checked;
        this.checkContainer.classList.remove('hidden');
      }
      else {
        this.checkContainer.classList.add('hidden');
      }

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

      this.ui.addEventListener('click', this.onClick);
      window.addEventListener('keydown', this.onKeyDown, true);
      window.addEventListener('keyup', this.onKeyUp, true);
      window.addEventListener('contextmenu', this.onContextMenu, true);
      window.addEventListener('pagehide', this.onUnload);
      window.addEventListener('beforeunload', this.onUnload);

      this.focusTargets[0].focus();

      range.detach();

      if (typeof this.params.onShown == 'function') {
        try {
          this.params.onShown(this.content);
        }
        catch(_error) {
        }
      }

      this.ui.classList.add('show');
      return new Promise((resolve, reject) => {
        this._resolve = resolve;
        this._rejecte = reject;
      });
    }

    async hide() {
      this.ui.classList.remove('show');
      if (typeof this.params.onHidden == 'function') {
        try {
          this.params.onHidden(this.content);
        }
        catch(_error) {
        }
      }
      this.ui.removeEventListener('click', this.onClick);
      window.removeEventListener('keydown', this.onKeyDown, true);
      window.removeEventListener('keyup', this.onKeyUp, true);
      window.removeEventListener('contextmenu', this.onContextMenu, true);
      window.removeEventListener('pagehide', this.onUnload);
      window.removeEventListener('beforeunload', this.onUnload);
      delete this._resolve;
      delete this._rejecte;
      return new Promise((resolve, _reject) => {
        window.setTimeout(() => {
          this.ui.parentNode.removeChild(this.ui);
          this.style.parentNode.removeChild(this.style);
          delete this.ui;
          delete this.style;
          resolve();
        }, 1000);
      });
    }

    dismiss() {
      this._resolve({
        buttonIndex: -1,
        checked: !!this.params.checkMessage && this.checkCheckbox.checked
      });
      return this.hide();
    }

    onClick(event) {
      let target = event.target;
      if (target.nodeType == Node.TEXT_NODE)
        target = target.parentNode;

      if (target.closest(`.rich-confirm-content.${this.commonClass}`) &&
          target.closest('input, textarea, select, button'))
        return;

      if (event.button != 0) {
        event.stopPropagation();
        event.preventDefault();
        return;
      }

      const button = target.closest('button');
      if (button) {
        event.stopPropagation();
        event.preventDefault();
        const buttonIndex = Array.from(this.buttonsContainer.childNodes).indexOf(button);
        const values = {};
        for (const field of this.content.querySelectorAll('[id], [name]')) {
          let value = null;
          if (field.matches('input[type="checkbox"]')) {
            value = field.checked;
          }
          else if (field.matches('input[type="radio"]')) {
            if (field.checked)
              value = field.value;
          }
          else if ('value' in field.dataset) {
            value = field.dataset.value;
          }
          else {
            value = field.value;
          }
          values[field.id || field.name] = value;
        }
        this._resolve({
          buttonIndex,
          values,
          checked: !!this.params.checkMessage && this.checkCheckbox.checked
        });
        this.hide();
        return;
      }

      if (!target.closest(`.rich-confirm-dialog.${this.commonClass}`)) {
        event.stopPropagation();
        event.preventDefault();
        this.dismiss();
      }
    }

    onKeyDown(event) {
      let target = event.target;
      if (target.nodeType == Node.TEXT_NODE)
        target = target.parentNode;
      const onContent = target.closest(`.rich-confirm-content.${this.commonClass}`);

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
        case 'PageUp':
          if (onContent)
            break;
          event.stopPropagation();
          event.preventDefault();
          this.advanceFocus(-1);
          break;

        case 'ArrowDown':
        case 'ArrowRight':
        case 'PageDown':
          if (onContent)
            break;
          event.stopPropagation();
          event.preventDefault();
          this.advanceFocus(1);
          break;

        case 'Home':
          if (onContent)
            break;
          event.stopPropagation();
          event.preventDefault();
          this.focusTargets[0].focus();
          break;

        case 'End':
          if (onContent)
            break;
          event.stopPropagation();
          event.preventDefault();
          const targets = this.focusTargets;
          targets[targets.length-1].focus();
          break;

        case 'Tab':
          event.stopPropagation();
          event.preventDefault();
          this.advanceFocus(event.shiftKey ? -1 : 1);
          break;

        case 'Escape':
          event.stopPropagation();
          event.preventDefault();
          this.dismiss();
          break;

        case 'Enter':
          if (onContent && !target.closest('textarea')) {
            event.stopPropagation();
            event.preventDefault();
            this.buttonsContainer.firstChild.click();
          }
          break;

        default:
          return;
      }
    }

    onKeyUp(event) {
      switch (event.key) {
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
          event.stopPropagation();
          event.preventDefault();
          break;

        default:
          return;
      }
    }

    onContextMenu(event) {
      let target = event.target;
      if (target.nodeType == Node.TEXT_NODE)
        target = target.parentNode;
      const onContent = target.closest(`.rich-confirm-content.${this.commonClass}`);
      if (!onContent || !target.closest('input, textarea')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }

    onUnload() {
      this.dismiss();
    }

    advanceFocus(direction) {
      const focusedItem = this.ui.querySelector(':focus');
      console.log('focusedItem ', focusedItem);
      const targets = this.focusTargets;
      console.log('focusTargets ', targets);
      const index = focusedItem ? targets.indexOf(focusedItem) : -1;
      if (direction < 0) { // backward
        const nextFocused = index < 0 ? targets[targets.length-1] :
          targets[index == 0 ? targets.length-1 : index-1];
        nextFocused.focus();
      }
      else { // forward
        const nextFocused = index < 0 ? targets[0] :
          targets[index == targets.length-1 ? 0 : index+1];
        nextFocused.focus();
      }
    }

    static async show(params) {
      const confirm = new this(params);
      return confirm.show();
    }
    static async showInTab(tabId, params) {
      if (!params) {
        params = tabId;
        tabId = await browser.tabs.getCurrent();
      }
      try {
        await browser.tabs.executeScript(tabId, {
          code: `
            if (!window.RichConfirm)
               (${defineRichConfirm.toString()})();
          `,
          matchAboutBlank: true,
          runAt:           'document_start'
        });
        browser.tabs.executeScript(tabId, {
          code: `
            delete window.RichConfirm.result;
            (async () => {
              const confirm = new RichConfirm(${JSON.stringify(params)});
              window.RichConfirm.result = await confirm.show();
            })();
          `,
          matchAboutBlank: true,
          runAt:           'document_start'
        });
        let result;
        while (true) {
          const results = await browser.tabs.executeScript(tabId, {
            code:            `window.RichConfirm.result`,
            matchAboutBlank: true,
            runAt:           'document_start'
          });
          if (results.length > 0 &&
          results[0] !== undefined) {
            result = results[0];
            break;
          }
          await new Promise((resolve, _reject) => setTimeout(resolve, 100));
        }
        return result;
      }
      catch(_e) {
        return {
          buttonIndex: -1
        };
      }
    }
  };
  RichConfirm.prototype.uniqueKey = parseInt(Math.random() * Math.pow(2, 16));
  window.RichConfirm = RichConfirm;
  return true; // this is required to run this script as a content script
})();
