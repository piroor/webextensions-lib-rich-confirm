# webextensions-lib-rich-confirm

[![Build Status](https://travis-ci.org/piroor/webextensions-lib-rich-confirm.svg?branch=master)](https://travis-ci.org/piroor/webextensions-lib-rich-confirm)

Helps to provide confirmation dialog with checkbox.

## Screenshots

![(Screenshot of a confimation dialog with two buttons and a checkbox)](screenshots/with-check.png)

## Required permissions

 * `tabs` or `activeTab`, if you want to use `RichConfirm.showInTab()`.

## Basic usage

Load the file `RichConfirm.js` from any document (background page, sidebar panel, or browser action panel), like:

```json
<script type="application/javascript" src="./RichConfirm.js"></script>
```

And, call `RichConfirm.show()` with required parameters like:

```javascript
var result = await RichConfirm.show({
  message:      'Are you ready?',
  buttons:      ['Yes', 'No'],
  checkMessage: 'Never show',
  checked:      false
});
```

Here is the list of parameters:

 * `message` (optional): A message for the confirmation dialog. This parameter is exclusive with `content`. (`String`)
 * `buttons` (required): Labels for buttons. (`Array` of `String`s)
 * `checkMessage` (optional): A label for the checkbox. (`String`)
 * `checked` (optional): Default state of the checkbox. (`Boolean`)

And there are more advanced parameters. See also the "Advanced usage" section.

 * `content` (optional): A source of HTML fragment to show as the content of the confirmation dialog. This parameter is exclusive with `message`. (`String`)
 * `onShown` (optional): Event handler when the dialog is shown. (`Function`)
 * `onHidden` (optional): Event handler when the dialog is hidden. (`Function`)

`RichConfirm.show()` returns a `Promise`. It will be resolved with an object with following attributes:

 * `buttonIndex`: The index of the button which is clicked. `-1` if the confirmation dialog is dismissed.
 * `checked`: The state of the checkbox.
 * `values`: The hash of values collected from input fields generated from the `content` parameter.

## Advanced usage

You can show a dialog with your favorite UI elements. For example:

```javascript
var title  = 'example';
var url    = 'http://example.com/';
var result = await RichConfirm.show({
  content: `
    <p><label>Name:
              <input type="text"
                     name="title"
                     value=${JSON.stringify(title)}></label></p>
    <p><label>Location:
              <input type="text"
                     name="url"
                     value=${JSON.stringify(url)}></label></p>
  `,
  onShown(container) {
    // This handler recenves the container element of contents
    // generated from the "content" parameter.
    // You can register listeners to generated fields or
    // do more initialization, like:
    // container.querySelector('input[name="title"]').addEventListener(...);
  },
  onHidden(container) {
    // You can destroy generated fields when the dialog is
    // closed, like:
    // container.querySelector('input[name="title"]').removeEventListener(...);
  },
  buttons: ['Save', 'Cancel']
});

// The result object has a hash "values" with properties
// same to "name" or "id" of generated fields.
console.log(result.values.title);
console.log(result.values.url);
```

## Confirmation in the content area

If you want to show the confirmation dialog in the content area, call `RichConfirm.showInTab()` with an ID of a tab, like:

```javascript
var result = await RichConfirm.showInTab(10, {
  message:      'Are you ready?',
  buttons:      ['Yes', 'No'],
  checkMessage: 'Never show',
  checked:      false
});
```

The first parameter is `tabs.Tab.id`, the second parameter is same to `RichConfirm.show()`. If you omit the first argument, the dialog will appear in the current tab.


## Confirmation in a popup

If you want to show the confirmation dialog as a popup window, call `RichConfirm.showInPopup()` with an ID of an owner window, like:

```javascript
var result = await RichConfirm.showInPopup(10, {
  message:      'Are you ready?',
  buttons:      ['Yes', 'No'],
  checkMessage: 'Never show',
  checked:      false
});
```

The first parameter is `windows.Window.id`, the second parameter is same to `RichConfirm.show()`. If you omit the first argument, the dialog will be placed on the last focused window.

