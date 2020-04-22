/*
 license: The MIT License, Copyright (c) 2018-2020 YUKI "Piro" Hiroshi
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
          left:0;
          pointer-events: none;
          z-index: 999997;
        }
        ${common}.rich-confirm.popup-window {
          background: -moz-dialog;
        }
        ${common}.rich-confirm:not(.popup-window) {
          background: rgba(0, 0, 0, 0.45);
          opacity: 0;
          transition: opacity 250ms ease-out;
        }

        ${common}.rich-confirm.show {
          opacity: 1;
          pointer-events: auto;
        }

        ${common}.rich-confirm-row {
          z-index: 999998;
        }

        ${common}.rich-confirm-dialog {
          color: -moz-dialogtext;
          font: message-box;
          overflow: auto;
          padding: 1em;
          z-index: 999999;
        }
        ${common}.rich-confirm-dialog:not(.popup-window) {
          background: -moz-dialog;
          box-shadow: 0.1em 0.1em 0.5em rgba(0, 0, 0, 0.65);
          margin: 0.5em;
          max-height: 90%;
          max-width: 90%;
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
      const commonClass = `${this.commonClass} ${this.params.popup ? 'popup-window' : ''}`;
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

    async show({ onShown } = {}) {
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
          this.params.onShown(this.content, this.params.inject || {});
        }
        catch(_error) {
        }
      }
      if (typeof onShown == 'function')
        onShown(this.content, this.params.inject || {});

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
          this.params.onHidden(this.content, this.params.inject || {});
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

      if (!this.params.popup &&
          !target.closest(`.rich-confirm-dialog.${this.commonClass}`)) {
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
        tabId = (await browser.tabs.getCurrent()).id;
      }
      const onSizeDetermined = params.onSizeDetermined;
      delete params.onSizeDetermined;
      const onShownListener = (message, sender) => {
        if (sender &&
            sender.tab &&
            sender.tab.id == tabId &&
            message &&
            typeof message == 'object' &&
            message.type == 'rich-confirm-dialog-shown') {
          onSizeDetermined({
            width:       message.rect.width,
            height:      message.rect.height,
            left:        message.rect.left,
            right:       message.rect.right,
            top:         message.rect.top,
            bottom:      message.rect.bottom,
            frameWidth:  message.frameWidth,
            frameHeight: message.frameHeight
          });
        }
      };
      if (typeof onSizeDetermined == 'function')
        browser.runtime.onMessage.addListener(onShownListener);
      try {
        await browser.tabs.executeScript(tabId, {
          code: `
            if (!window.RichConfirm)
               (${defineRichConfirm.toString()})();
          `,
          matchAboutBlank: true,
          runAt:           'document_start'
        });
        const transferableParams = { ...params };
        const injectTransferable = [];
        const inject = params.inject || {};
        delete transferableParams.inject;
        for (const key in params.inject) {
          const value = inject[key];
          const transferable = (
            value &&
            typeof value == 'function' &&
            typeof value.toString == 'function'
          ) ? value.toString() : JSON.stringify(value);
          injectTransferable.push(`${JSON.stringify(key)} : ${transferable}`);
        }
        const originalOnShown = typeof params.onShown == 'function' ?
          params.onShown.toString()
            .replace(/^(async\s+)?function/, '$1')
            .replace(/^(async\s+)?/, '$1 function ') :
          '() => {}';
        delete transferableParams.onShown;
        browser.tabs.executeScript(tabId, {
          code: `
            delete window.RichConfirm.result;
            (async (originalOnShown, inject) => {
              const params = ${JSON.stringify(transferableParams)};
              const confirm = new RichConfirm({
                ...params,
                inject,
                onShown(content, inject) {
                  try {
                    if (typeof originalOnShown == 'function')
                      originalOnShown(content, inject);
                    browser.runtime.sendMessage({
                      type: 'rich-confirm-dialog-shown',
                      rect: content.closest('.rich-confirm-dialog').getBoundingClientRect(),
                      frameWidth:  window.outerWidth - window.innerWidth,
                      frameHeight: window.outerHeight - window.innerHeight
                    });
                  }
                  catch(error) {
                    console.error(error);
                  }
                }
              });
              window.RichConfirm.result = await confirm.show();
            })(
              (${originalOnShown}),
              {${injectTransferable.join(',')}}
            );
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
      catch(error) {
        console.error(error);
        return {
          buttonIndex: -1
        };
      }
      finally {
        if (typeof onSizeDetermined == 'function')
          browser.runtime.onMessage.removeListener(onShownListener);
      }
    }

    static async showInPopup(winId, params) {
      let ownerWin;
      if (!params) {
        params = winId;
        ownerWin = await browser.windows.getLastFocused({});
      }
      else {
        ownerWin = await browser.windows.get(winId);
      }
      const win = await browser.windows.create({
        url:    'about:blank',
        type:   'popup',
        // Step 1:
        // Open a small window to suppress annoying large white rect
        // covering on the window.
        width:  16,
        height: 16
      });
      const activeTab = win.tabs.find(tab => tab.active);

      // Step 2:
      // Resize the window to expected size on outside of the screen.
      if (/mac/i.test(navigator.platform)) {
        // On macOS environment this operation must be done separately before
        // window move, because resizing of a window outside the visible area
        // moves the window into the main screen unexpectedly.
        await browser.windows.update(win.id, {
          width:  ownerWin.width,
          height: ownerWin.height
        });
        // Step 2.5:
        // Move the window outside the visible area, until all UI elements are
        // prepared.
        // The coordinates must be positive integer because large negative
        // coordinates don't work as expected on macOS.
        await browser.windows.update(win.id, {
          top:  window.screen.height * 100,
          left: window.screen.width * 100
        });
      }
      else {
        await browser.windows.update(win.id, {
          width:  ownerWin.width,
          height: ownerWin.height,
          top:  window.screen.height * 100,
          left: window.screen.width * 100
        });
      }

      const onFocusChanged = !params.modal ? null : windowId => {
        if (windowId == ownerWin.id)
          browser.windows.update(win.id, { focused: true });
      };
      if (onFocusChanged)
      browser.windows.onFocusChanged.addListener(onFocusChanged);

      await new Promise((resolve, _reject) => {
        const onTabUpdated = (tabId, updateInfo, _tab) => {
          if (updateInfo.status != 'complete' ||
              !browser.tabs.onUpdated.hasListener(onTabUpdated))
            return;
          browser.tabs.onUpdated.removeListener(onTabUpdated);
          resolve();
        };
        setTimeout(() => {
          if (!browser.tabs.onUpdated.hasListener(onTabUpdated))
            return;
          browser.tabs.onUpdated.removeListener(onTabUpdated);
          resolve();
        }, 100);
        browser.tabs.onUpdated.addListener(onTabUpdated, {
          properties: ['status'],
          tabId:      activeTab.id
        });
      });

      if (params.title) {
        browser.tabs.executeScript(activeTab.id, {
          code:            `document.title = ${JSON.stringify(params.title)};`,
          matchAboutBlank: true,
          runAt:           'document_start'
        });
      }

      const result = await this.showInTab(activeTab.id, {
        ...params,
        popup: true,
        async onSizeDetermined(coordinates) {
          // Final Step:
          // Shrink the window and move it to the expected position.
          const safetyFactor = 1.05; // safe guard for scrollbar due to unexpected line breaks
          const width  = Math.ceil((coordinates.width + coordinates.frameWidth) * safetyFactor);
          const height = Math.ceil((coordinates.height + coordinates.frameHeight));
          browser.windows.update(win.id, {
            width,
            height,
            top:  Math.floor(ownerWin.top + ((ownerWin.height - height) / 2)),
            left: Math.floor(ownerWin.left + ((ownerWin.width - width) / 2))
          })
        }
      });
      if (onFocusChanged)
      browser.windows.onFocusChanged.removeListener(onFocusChanged);
      browser.windows.remove(win.id);
      return result;
    }
  };
  RichConfirm.prototype.uniqueKey = parseInt(Math.random() * Math.pow(2, 16));
  window.RichConfirm = RichConfirm;
  return true; // this is required to run this script as a content script
})();
