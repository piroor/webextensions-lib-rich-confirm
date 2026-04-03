/*
 license: The MIT License, Copyright (c) 2018-2026 YUKI "Piro" Hiroshi
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

    this.Dialog = (await import(this.dialogJsPath)).default;
  }

  static get uniqueKey() {
    return this.$uniqueKey ||= parseInt(Math.random() * Math.pow(2, 16));
  }

  static get DIALOG_READY_NOTIFICATION_TYPE() {
    return `__RichConfirm_${this.uniqueKey}__confirmation-dialog-ready`;
  }

  static async show(params) {
    if (!this.Dialog) {
      await this.ensureDialogClassLoaded();
    }
    const confirm = new this.Dialog({
      tab:       false,
      popup:     false,
      ...params,
      uniqueKey: this.uniqueKey,
    });
    return confirm.show();
  }

  static async showInTab(tabId, params) {
    if (!params) {
      params = tabId;
      tabId = (await browser.tabs.getCurrent()).id;
    }
    if (!this.dialogHtmlPath) {
      throw new Error('RichConfirm is not initialized. Call RichConfirm.init() first.');
    }

    let onMessage, onTabRemoved, onTabUpdated, onWindowClosed;
    const uniqueKey = this.uniqueKey;
    const oneTimeKey = `tab-${uniqueKey}-${Date.now()}-${parseInt(Math.random() * Math.pow(2, 16))}`;

    const dialogFullUrl = `${this.dialogHtmlPath}?__RichConfirm__=1&uniqueKey=${encodeURIComponent(uniqueKey)}&oneTimeKey=${encodeURIComponent(oneTimeKey)}&params=${encodeURIComponent(JSON.stringify({tab: true, popup: false, ...params}))}`;

    const targetTabInfo = await browser.tabs.get(tabId).catch(() => null);
    const targetWinId = targetTabInfo?.windowId;

    const alphabets = 'abcdefghijklmnopqrstuvwxyz';
    const prefix = alphabets[Math.floor(Math.random() * alphabets.length)];
    const customElementName = `${prefix}-${Date.now()}-${Math.round(Math.random() * 65000)}`;

    const promisedResult = new Promise((resolve, _reject) => {
      onMessage = (message, _sender) => {
        if (message?.uniqueKey != uniqueKey ||
            message?.oneTimeKey != oneTimeKey)
          return;

        switch (message.type) {
          case 'rich-confirm-dialog-complete':
            resolve(message.result);
            break;
        }
      };
      browser.runtime.onMessage.addListener(onMessage);
    });

    const promisedDismissed = new Promise((resolve, _reject) => {
      onTabRemoved = (removedTabId, _removeInfo) => {
        if (removedTabId == tabId)
          resolve({ buttonIndex: -1 });
      };
      onTabUpdated = (updatedTabId, changeInfo, _tab) => {
        if (updatedTabId == tabId && changeInfo.status == 'loading')
          resolve({ buttonIndex: -1 });
      };
      onWindowClosed = windowId => {
        if (targetWinId && windowId == targetWinId)
          resolve({ buttonIndex: -1 });
      };
      browser.tabs.onRemoved.addListener(onTabRemoved);
      browser.tabs.onUpdated.addListener(onTabUpdated);
      browser.windows.onRemoved.addListener(onWindowClosed);
    });

    try {
      const run = function run(url, uniqueKey, oneTimeKey, customElementName) {
        const idKey = `rich-confirm-${uniqueKey}-${oneTimeKey}`;
        window.__RichConfirm_Containers__ = window.__RichConfirm_Containers__ || new Map();
        let container = window.__RichConfirm_Containers__.get(idKey);
        if (!container) {
          const type = window.__RichConfirm_ClosedContainerType__ || customElementName;
          window.__RichConfirm_ClosedContainerType__ = type;
          if (!window.customElements.get(type)) {
            class RichConfirmContainer extends HTMLElement {}
            window.customElements.define(type, RichConfirmContainer);
          }

          container = document.createElement(type);
          container.setAttribute('style', 'background: transparent; border: 0 none; bottom: 0; color-scheme: light dark; height: 100%; left: 0; position: fixed; right: 0; top: 0; width: 100%; z-index: 2147483647;');

          const shadow = container.attachShadow({ mode: 'closed' });
          const iframe = document.createElement('iframe');
          iframe.setAttribute('style', 'background: transparent; border: 0 none; height: 100%; width: 100%;');
          iframe.src = url;
          shadow.appendChild(iframe);

          (document.body || document.documentElement).appendChild(container);
          window.__RichConfirm_Containers__.set(idKey, container);
        }
      };

      if (typeof browser.tabs.executeScript == 'function') { // Manifest V2
        await browser.tabs.executeScript(tabId, {
          code: `(${run.toString()})(${JSON.stringify(dialogFullUrl)}, ${JSON.stringify(uniqueKey)}, ${JSON.stringify(oneTimeKey)}, ${JSON.stringify(customElementName)});`,
          matchAboutBlank: true,
          runAt:           'document_end'
        });
      }
      else { // Manifest V3
        await browser.scripting.executeScript({
          target: { tabId },
          func: run,
          args: [dialogFullUrl, uniqueKey, oneTimeKey, customElementName]
        });
      }

      const result = await Promise.race([promisedResult, promisedDismissed]);
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
      if (browser.windows.onRemoved.hasListener(onWindowClosed))
        browser.windows.onRemoved.removeListener(onWindowClosed);

      const cleanup = function(uniqueKey, oneTimeKey) {
        const idKey = `rich-confirm-${uniqueKey}-${oneTimeKey}`;
        const map = window.__RichConfirm_Containers__;
        if (map) {
          const container = map.get(idKey);
          if (container) {
            container.remove();
            map.delete(idKey);
          }
        }
      };

      if (typeof browser.tabs.executeScript == 'function') { // Manifest V2
        browser.tabs.executeScript(tabId, {
          code: `(${cleanup.toString()})(${JSON.stringify(uniqueKey)}, ${JSON.stringify(oneTimeKey)});`,
          matchAboutBlank: true,
          runAt:           'document_end'
        }).catch(() => {});
      }
      else { // Manifest V3
        browser.scripting.executeScript({
          target: { tabId },
          func: cleanup,
          args: [uniqueKey, oneTimeKey]
        }).catch(() => {});
      }
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

    const openInTab = (
      params.forceInTab /* for debugging */ ||
      (/^Mac/i.test(navigator.platform) &&
       ownerWin.state == 'fullscreen')
    );
    let dialogFullUrl, simulatedSize;

    // on macOS, a popup window opened from a fullscreen browser window is always
    // opened as a new fullscreen window, thus we need to fallback to a workaround.
    if (openInTab) {
      dialogFullUrl = `${this.dialogHtmlPath}?__RichConfirm__=1&uniqueKey=${encodeURIComponent(uniqueKey)}&oneTimeKey=${encodeURIComponent(oneTimeKey)}&params=${encodeURIComponent(JSON.stringify({tab: true, popup: false, ...params, ownerWindowId: ownerWin.id}))}`;
    }
    else {
      dialogFullUrl = `${this.dialogHtmlPath}?__RichConfirm__=1&uniqueKey=${encodeURIComponent(uniqueKey)}&oneTimeKey=${encodeURIComponent(oneTimeKey)}&params=${encodeURIComponent(JSON.stringify({tab: false, popup: true, ...params, ownerWindowId: ownerWin.id}))}`;

      const minWidth  = Math.max(ownerWin.width, Math.ceil(screen.availWidth / 3));
      const minHeight = Math.max(ownerWin.height, Math.ceil(screen.availHeight / 3));

      // Simulated run on the current window to calculate size
      if (!this.Dialog) {
        await this.ensureDialogClassLoaded();
      }
      const simulation = new this.Dialog({
        tab:        false,
        popup:      true,
        ...params,
        uniqueKey,
        simulation: true,
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
      simulatedSize = {
        width:  Math.ceil(simulatedRect.width * safetyFactor),
        height: Math.ceil(simulatedRect.height * safetyFactor)
      };
      simulation.hide();

      simulatedSize.top  = ownerWin.top + Math.floor((ownerWin.height - simulatedSize.height) / 2);
      simulatedSize.left = ownerWin.left + Math.floor((ownerWin.width - simulatedSize.width) / 2);
    }

    let onMessage;
    const promisedResult = new Promise((resolve, _reject) => {
      onMessage = (message, sender) => {
        switch (message?.type) {
          case this.DIALOG_READY_NOTIFICATION_TYPE:
            this._tryRepositionDialogToCenterOfOwner({
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
      browser.runtime.onMessage.addListener(onMessage);
    });

    let canvasTab, win;
    if (openInTab) {
      win = ownerWin;
      await Promise.race([
        (() => {
          let onUpdated;
          return  new Promise(async (resolve, _reject) => {
            onUpdated = (tabId, changes, tab) => {
              if (tabId != canvasTab?.id ||
                  changes.status != 'complete' ||
                  tab.url != dialogFullUrl)
                return;
              resolve();
            };
            browser.tabs.onUpdated.addListener(onUpdated);
            canvasTab = await browser.tabs.create({
              windowId: ownerWin.id,
              url:      dialogFullUrl,
              active:   true
            });
          })
            .finally(() => {
              browser.tabs.onUpdated.removeListener(onUpdated);
            });
        })(),
        new Promise(resolve => setTimeout(resolve, 1000)),
      ]);
    }
    else {
      win = await this._safeCreateWindow({
        url:  dialogFullUrl,
        type: 'popup',
        ...simulatedSize,
      });
      // Due to a Firefox's bug we cannot open popup type window
      // at specified position.
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1271047
      // Thus we need to move the window immediately after it is opened.
      if (win.left + win.width - (win.width / 2) <= ownerWin.left ||
          win.top + win.height - (win.height / 2) <= ownerWin.top ||
          win.left + (win.width / 2) >= ownerWin.left + ownerWin.width ||
          win.top + (win.height / 2) >= ownerWin.top + ownerWin.height) {
        // But, such a move will produce an annoying flash.
        // So, I grudgingly accept the position of the dialog placed
        // if the popup (partially or fully) covers the owner window.
        browser.windows.update(win.id, {
          top:  simulatedSize.top,
          left: simulatedSize.left
        });
      }
      canvasTab = win.tabs.find(tab => tab.active);
    }

    let onWindowClosed, onTabClosed;
    const promisedDismissed = new Promise((resolve, _reject) => {
      onWindowClosed = windowId => {
        if (win?.closed) {
          return;
        }
        switch (windowId) {
          case ownerWin.id:
            if (win)
              browser.windows.remove(win.id);
            break;
          case win?.id:
            win.closed = true;
            resolve({ buttonIndex: -1 });
            break;
        }
      };
      onTabClosed = (tabId, removeInfo) => {
        if (win.closed || !removeInfo.isWindowClosing) {
          return;
        }
        switch (removeInfo.windowId) {
          case ownerWin.id:
            if (win)
              browser.windows.remove(win.id);
            break;

          case win?.id:
            win.closed = true;
            resolve({ buttonIndex: -1 });
            break;

          default:
            if (tabId == canvasTab.id)
              resolve({ buttonIndex: -1 });
            break;
        }
      };
      browser.windows.onRemoved.addListener(onWindowClosed);
      browser.tabs.onRemoved.addListener(onTabClosed);
    });

    const onFocusChanged = async windowId => {
      if (!params.modal ||
          windowId != ownerWin.id) {
        return;
      }
      console.log(`focus of the window ${ownerWin.id} which is the owner of a modal dialog ${win.id} is changed`);
      const [updatedWin, updatedOwnerWin] = await Promise.all([
        browser.windows.get(win.id),
        browser.windows.get(ownerWin.id),
      ]);
      if (updatedOwnerWin?.state == 'minimized') {
        console.log(' => but the owner window is minimized');
        if (updatedWin.state != 'minimized') {
          console.log(' => minimize the modal dialog also');
          browser.windows.update(win.id, { state: 'minimized' });
        }
        return;
      }
      browser.windows.update(win.id, { focused: true });
    };
    browser.windows.onFocusChanged.addListener(onFocusChanged);

    try {
      return await Promise.race([promisedResult, promisedDismissed]);
    }
    finally {
      if (browser.runtime.onMessage.hasListener(onMessage))
        browser.runtime.onMessage.removeListener(onMessage);
      if (browser.windows.onRemoved.hasListener(onWindowClosed))
        browser.windows.onRemoved.removeListener(onWindowClosed);
      if (browser.tabs.onRemoved.hasListener(onTabClosed))
        browser.tabs.onRemoved.removeListener(onTabClosed);
      if (browser.windows.onFocusChanged.hasListener(onFocusChanged))
        browser.windows.onFocusChanged.removeListener(onFocusChanged);

      if (openInTab ||
          (win && !win.closed)) {
        /*
        // A window/tab closed with a blank page won't appear
        // in the "Recently Closed Windows/Tabs" list.
        const onTabUpdated = (tabId, changeInfo, tab) => {
          if (tabId != canvasTab.id ||
              tab.url != 'about:blank' ||
              changeInfo.status == 'loading')
            return;
          browser.tabs.onUpdated.removeListener(onTabUpdated);
          if (openInTab)
            browser.tabs.remove(canvasTab.id);
          else
            browser.windows.remove(win.id).catch(()=>{});
        };
        browser.tabs.onUpdated.addListener(onTabUpdated);
        browser.tabs.update(canvasTab.id, { url: 'about:blank' });
        */
        if (openInTab)
          browser.tabs.remove(canvasTab.id);
        else
          browser.windows.remove(win.id).catch(()=>{});
      }
    }
  }

  // Workaround for a problem on an overload situation.
  // When the system is in overload, the promise returned by browser.windows.create()
  // won't be resolved forever (until the window is closed).
  // So, we detect the opened window without the promise in different way
  // based on its unique URL.
  static async _safeCreateWindow(params) {
    const existingWindowIds = new Set((await browser.windows.getAll()).map(win => win.id));
    // We must not add any extra query or hash for "about:blank", because it is very special URL.
    // Extension with <all_urls> permission can inject arbitrary script to an "about:blank" page,
    // but injection will fail for URIs like "about:blank#..." with missing host permission.
    // Moreover, dialog window with "about:blank" is used to avoid closed windows restoration.
    const uniqueKeyParam = params.url == 'about:blank' ? null : `popup-id-for-${this.uniqueKey}=${parseInt(Math.random() * Math.pow(2, 16))}`;
    const dialogUrl = !uniqueKeyParam ? params.url : params.url.replace(/[?#]|$/, matched => {
      if (!matched)
        return `#${uniqueKeyParam}`;
      if (matched == '?')
        return `?${uniqueKeyParam}&`;
      return `?#{uniqueKeyParam}#`;
    });
    let win;
    const promisedWin = browser.windows.create({
      ...params,
      url: dialogUrl,
    }).then(resolvedWin => {
      // The returned promise won't be resolved until the opened window become fucused.
      console.log('RichConfirm._safeCreateWindow: promised window is resolved');
      win = resolvedWin;
    });
    while (!win) {
      await Promise.race([
        new Promise(async (resolve, _reject) => {
          if (win)
            return resolve();
          const windows = await browser.windows.getAll({ populate: true });
          if (win)
            return resolve();
          for (const window of windows) {
            if (existingWindowIds.has(window.id) ||
                (uniqueKeyParam ? !window.tabs[0].url.includes(uniqueKeyParam) : window.tabs[0].url != dialogUrl))
              continue;

            console.log('RichConfirm._safeCreateWindow: new window is detected');
            win = window;
            resolve();
            return;
          }
          setTimeout(resolve, 150);
        }),
        promisedWin,
      ]);
    }
    win.dialogUrl = dialogUrl;
    return win;
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
RichConfirm.Dialog = null;

export default RichConfirm;
