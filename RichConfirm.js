/*
 license: The MIT License, Copyright (c) 2018-2025 YUKI "Piro" Hiroshi
 original:
   https://github.com/piroor/webextensions-lib-rich-confirm
*/
'use strict';

class RichConfirm {
  static init(dialogHtmlPath) {
    this.dialogHtmlPath = dialogHtmlPath;
    this.dialogJsPath = dialogHtmlPath.replace(/\.html$/, '.js');
  }

  static async ensureDialogClassLoaded() {
    if (this.Dialog)
      return;

    if (!this.dialogJsPath) {
      if (document.currentScript?.src) {
        // Try to auto-resolve from document.currentScript if not initialized via init()
        const currentSrc = document.currentScript.src;
        this.dialogJsPath = currentSrc.replace(/RichConfirm\.js$/, 'RichConfirmDialog.js');
        this.dialogHtmlPath = currentSrc.replace(/RichConfirm\.js$/, 'RichConfirmDialog.html');
      } else {
        throw new Error('RichConfirm is not initialized. Call RichConfirm.init() first.');
      }
    }

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.dialogJsPath;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    this.Dialog = window[this.DIALOG_CLASS_NAME];
  }

  static async show(params) {
    if (!this.Dialog) {
      await this.ensureDialogClassLoaded();
    }
    const confirm = new this.Dialog({
      ...params,
      uniqueKey: this.uniqueKey
    });
    return confirm.show();
  }

  static async showInTab(tabId, params) {
    if (!params) {
      params = tabId;
      tabId = (await browser.tabs.getCurrent()).id;
    }
    if (!this.dialogJsPath) {
      throw new Error('RichConfirm is not initialized. Call RichConfirm.init() first.');
    }

    let onMessage, onTabRemoved, onTabUpdated;
    const uniqueKey = this.uniqueKey;
    const oneTimeKey = `popup-${uniqueKey}-${Date.now()}-${parseInt(Math.random() * Math.pow(2, 16))}`;
    const promisedResult = new Promise((resolve, _reject) => {
      onMessage = (message, _sender) => {
        if (message?.uniqueKey != uniqueKey ||
            message?.oneTimeKey != oneTimeKey)
          return;

        switch (message.type) {
          case 'rich-confirm-dialog-shown':
            if (typeof params.onReady == 'function') {
              try {
                params.onReady({
                  width:  message.dialogWidth,
                  height: message.dialogHeight
                });
              }
              catch(error) {
                console.error(error);
              }
            }
            if (typeof params.onDialogOpened == 'function') {
              try {
                params.onDialogOpened({
                  close() {
                    browser.tabs.sendMessage(tabId, {
                      type: 'rich-confirm-dialog-close',
                      uniqueKey,
                      oneTimeKey,
                    });
                  },
                  updateContent({ content, message }) {
                    browser.tabs.sendMessage(tabId, {
                      type: 'rich-confirm-dialog-update-content',
                      uniqueKey,
                      oneTimeKey,
                      content,
                      message,
                    });
                  },
                });
              }
              catch(error) {
                console.error(error);
              }
            }
            break;

          case 'rich-confirm-dialog-complete':
            resolve(message.result);
            break;
        }
      };
      onTabRemoved = (removedTabId, _removeInfo) => {
        if (removedTabId == tabId)
          resolve({ buttonIndex: -1 });
      };
      onTabUpdated = (updatedTabId, changeInfo, _tab) => {
        if (updatedTabId == tabId && changeInfo.status == 'loading')
          resolve({ buttonIndex: -1 });
      };
      browser.runtime.onMessage.addListener(onMessage);
      browser.tabs.onRemoved.addListener(onTabRemoved);
      browser.tabs.onUpdated.addListener(onTabUpdated);
    });

    try {
      // Fetch the script code first to inject it
      const response = await fetch(this.dialogJsPath);
      const codeToInject = await response.text();

      if (typeof browser.tabs.executeScript == 'function') { // Manifest V2
        await browser.tabs.executeScript(tabId, {
          code: codeToInject,
          matchAboutBlank: true,
          runAt:           'document_start'
        });
      }
      else { // Manifest V3
        await browser.scripting.executeScript({
          target: { tabId },
          func: (codeStr) => {
            if (!this.Dialog) {
              const script = document.createElement('script');
              script.textContent = codeStr;
              (document.head || document.documentElement).appendChild(script);
              script.remove();
            }
          },
          args: [codeToInject]
        });
      }

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

      const run = async function run(uniqueKey, oneTimeKey, transferableParams, inject) {
        delete this.Dialog.result; // clean up old result if any
        const confirm = new this.Dialog({
          ...transferableParams,
          uniqueKey,
          inject: inject || {},
        });
        const onMessage = (message, _sender) => {
          if (message?.uniqueKey != uniqueKey ||
              message?.oneTimeKey != oneTimeKey) {
            return;
          }
          switch (message?.type) {
            case 'rich-confirm-dialog-close':
              confirm.hide();
              break;

            case 'rich-confirm-dialog-update-content':
              confirm.updateContent(message);
              break;
          }
        }
        browser.runtime.onMessage.addListener(onMessage);
        try {
          confirm.onShown = async (content, _injected) => {
            const dialog = content.parentNode;
            const rect   = dialog.getBoundingClientRect();
            const style  = window.getComputedStyle(dialog, null);
            // End padding is not included in the scrillable size,
            // so we manually add them.
            const inlineEndPadding  = dialog.scrollLeftMax > 0 && parseFloat(style.getPropertyValue('padding-inline-end')) || 0;
            const bottomPadding = dialog.scrollTopMax > 0 && parseFloat(style.getPropertyValue('padding-bottom')) || 0;
            browser.runtime.sendMessage({
              type:         'rich-confirm-dialog-shown',
              uniqueKey,
              oneTimeKey,
              dialogWidth:  rect.width + dialog.scrollLeftMax + inlineEndPadding,
              dialogHeight: rect.height + dialog.scrollTopMax + bottomPadding
            });
          };
          const result = await confirm.show();
          browser.runtime.sendMessage({
            type:      'rich-confirm-dialog-complete',
            uniqueKey,
            oneTimeKey,
            result
          });
        }
        finally {
          browser.runtime.onMessage.removeListener(onMessage);
        }
      };

      if (typeof browser.tabs.executeScript == 'function') // Manifest V2
        browser.tabs.executeScript(tabId, {
          code: `
            (${run.toString()})(
              ${JSON.stringify(this.uniqueKey)},
              ${JSON.stringify(oneTimeKey)},
              ${JSON.stringify(transferableParams)},
              {${injectTransferable.join(',')}}
            );
          `,
          matchAboutBlank: true,
          runAt:           'document_start'
        });
      else // Manifest V3
        browser.scripting.executeScript({
          target: { tabId },
          func: run,
          args: [this.uniqueKey, oneTimeKey, transferableParams, inject],
        });

      const result = await promisedResult;
      return result;
    }
    catch(error) {
      console.error(error, error.stack);
      return {
        buttonIndex: -1
      };
    }
    finally {
      if (browser.runtime.onMessage.hasListener(onMessage))
        browser.runtime.onMessage.removeListener(onMessage);
      if (browser.tabs.onRemoved.hasListener(onTabRemoved))
        browser.tabs.onRemoved.removeListener(onTabRemoved);
      if (browser.tabs.onUpdated.hasListener(onTabUpdated))
        browser.tabs.onUpdated.removeListener(onTabUpdated);
    }
  }

  static async showInPopup(ownerWinId, params) {
    let ownerWin;
    if (!params) {
      params = ownerWinId;
      ownerWin = await browser.windows.getLastFocused({});
    }
    else {
      try {
        ownerWin = await browser.windows.get(ownerWinId).catch(_error => null);
      }
      catch(_error) {
      }
      if (!ownerWin) {
        ownerWin = await browser.windows.getLastFocused({});
      }
    }

    if (!this.dialogHtmlPath)
      throw new Error('RichConfirm is not initialized. Call RichConfirm.init() first.');

    const uniqueKey = this.uniqueKey;
    const oneTimeKey = `popup-${uniqueKey}-${Date.now()}-${parseInt(Math.random() * Math.pow(2, 16))}`;

    const tryRepositionDialogToCenterOfOwner = this._tryRepositionDialogToCenterOfOwner;
    const DIALOG_READY_NOTIFICATION_TYPE = this.DIALOG_READY_NOTIFICATION_TYPE;
    const dialogFullUrl = `${this.dialogHtmlPath}?__RichConfirm__=1&uniqueKey=${encodeURIComponent(uniqueKey)}&oneTimeKey=${encodeURIComponent(oneTimeKey)}&params=${encodeURIComponent(JSON.stringify({...params, ownerWindowId: ownerWin.id, onShown: undefined, onDialogOpened: undefined, inject: undefined}))}`;

    const minWidth  = Math.max(ownerWin.width, Math.ceil(screen.availWidth / 3));
    const minHeight = Math.max(ownerWin.height, Math.ceil(screen.availHeight / 3));

    // Simulated run on the current window to calculate size
    if (!this.Dialog) {
      await this.ensureDialogClassLoaded();
    }
    const simulation = new this.Dialog({
      ...params,
      uniqueKey,
      popup: true,
      simulation: true
    });
    simulation.buildUI();
    const simulatedContainer = simulation.ui.querySelector('.rich-confirm-row');
    simulatedContainer.style.minWidth  = `${minWidth}px`;
    simulatedContainer.style.minHeight = `${minHeight}px`;
    await new Promise((resolve, _reject) => {
      simulation.onShown = () => {
        setTimeout(() => {
          resolve();
        }, 0);
      };
      simulation.show();
    });
    const simulatedDialog = simulation.ui.querySelector('.rich-confirm-dialog');
    const simulatedRect   = simulatedDialog.getBoundingClientRect();

    const safetyFactor  = 1.05;
    const simulatedSize = {
      width:  Math.ceil(simulatedRect.width * safetyFactor),
      height: Math.ceil(simulatedRect.height * safetyFactor)
    };
    simulation.hide();

    simulatedSize.top  = ownerWin.top + Math.floor((ownerWin.height - simulatedSize.height) / 2);
    simulatedSize.left = ownerWin.left + Math.floor((ownerWin.width - simulatedSize.width) / 2);

    let onMessage, onWindowClosed;
    let win;
    const promisedResult = new Promise((resolve, _reject) => {
      onMessage = (message, sender) => {
        switch (message?.type) {
          case DIALOG_READY_NOTIFICATION_TYPE:
            tryRepositionDialogToCenterOfOwner({
              ...message,
              dialogWindowId: sender.tab.windowId,
            });
            break;

          case 'rich-confirm-dialog-complete':
            if (message?.uniqueKey == uniqueKey &&
                message?.oneTimeKey == oneTimeKey) {
              resolve(message.result);
            }
            break;
        }
      };
      onWindowClosed = windowId => {
        if (windowId == win?.id) {
          win.closed = true;
          resolve({ buttonIndex: -1 });
        }
      };
      browser.runtime.onMessage.addListener(onMessage);
      browser.windows.onRemoved.addListener(onWindowClosed);
    });

    win = await browser.windows.create({
      url: dialogFullUrl,
      type: 'popup',
      ...simulatedSize
    });

    if (win.left + win.width - (win.width / 2) <= ownerWin.left ||
        win.top + win.height - (win.height / 2) <= ownerWin.top ||
        win.left + (win.width / 2) >= ownerWin.left + ownerWin.width ||
        win.top + (win.height / 2) >= ownerWin.top + ownerWin.height) {
      browser.windows.update(win.id, {
        top:  simulatedSize.top,
        left: simulatedSize.left
      });
    }

    try {
      return await promisedResult;
    }
    finally {
      if (browser.runtime.onMessage.hasListener(onMessage))
        browser.runtime.onMessage.removeListener(onMessage);
      if (browser.windows.onRemoved.hasListener(onWindowClosed))
        browser.windows.onRemoved.removeListener(onWindowClosed);
      
      if (win && !win.closed) {
        browser.windows.remove(win.id).catch(()=>{});
      }
    }
  }

  static async _tryRepositionDialogToCenterOfOwner({ dialogWindowId, ownerWindowId, availLeft, availTop, availWidth, availHeight }) {
    const [dialogWin, ownerWin] = await Promise.all([
      browser.windows.get(dialogWindowId),
      browser.windows.get(ownerWindowId),
    ]);
    const placedOnOwner = (
      dialogWin.left + dialogWin.width - (dialogWin.width / 2) < ownerWin.left &&
      dialogWin.top + dialogWin.height - (dialogWin.height / 2) < ownerWin.top &&
      dialogWin.left + (dialogWin.width / 2) < ownerWin.left + ownerWin.width &&
      dialogWin.top + (dialogWin.height / 2) < ownerWin.top + ownerWin.height
    );
    const placedInsideViewArea = (
      dialogWin.left >= availLeft &&
      dialogWin.top >= availTop &&
      dialogWin.left + dialogWin.width <= availLeft + availWidth &&
      dialogWin.top + dialogWin.height <= availTop + availHeight
    );
    if (placedOnOwner && placedInsideViewArea)
      return;

    const top  = ownerWin.top + Math.round((ownerWin.height - dialogWin.height) / 2);
    const left = ownerWin.left + Math.round((ownerWin.width - dialogWin.width) / 2);
    return browser.windows.update(dialogWin.id, {
      left: Math.min(availLeft + availWidth - dialogWin.width, Math.max(availLeft, left)),
      top:  Math.min(availTop + availHeight - dialogWin.height, Math.max(availTop, top)),
    });
  }
}
RichConfirm.uniqueKey = parseInt(Math.random() * Math.pow(2, 16));
RichConfirm.DIALOG_READY_NOTIFICATION_TYPE = `__RichConfirm_${RichConfirm.uniqueKey}__confirmation-dialog-ready`;
RichConfirm.DIALOG_CLASS_NAME = 'RichConfirmDialog';
RichConfirm.Dialog = null;
window.RichConfirm = RichConfirm;
