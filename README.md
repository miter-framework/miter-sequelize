[![Build Status](https://travis-ci.org/miter-framework/miter-sequelize.svg?branch=master)](https://travis-ci.org/miter-framework/miter-sequelize)

# miter-sequelize

This module, miter-sequelize, is a ORM implementation that wraps Sequelize.
It is intended to be used as a plugin for the [Miter Framework][miter].
This module is experimental.

## Installation

First, install `miter-sequlize` using NPM.

```bash
npm install --save miter-sequelize
```

Next, inject `SequelizeORMService` into your Miter server when it is launched.

```typescript
import { Miter, ORMService } from 'miter';
import { SequelizeORMService } from 'miter-sequelize';

Miter.launch({
    // ...
    
    provide: [
        // ...
        { provide: ORMService, useClass: SequelizeORMService }
    ]
});
```

## Contributing

Miter-Sequelize is an experimental plugin to Miter, which is itself a relatively young framework.
There are many ways that it can be improved.
If you notice a bug, or would like to request a feature, feel free to [create an issue][create_issue].
Better yet, you can [fork the project][fork_project] and submit a pull request with the added feature.

## Changelog

[See what's new][whats_new] in recent versions of Miter.

## Attribution

Special thanks to [BrowserStack][browserstack] for generously hosting our cross-browser integration tests!

[![BrowserStack](./attribution/browser-stack.png)][browserstack]

[miter]: https://github.com/miter-framework/miter
[create_issue]: https://github.com/miter-framework/miter-sequelize/issues/new
[fork_project]: https://github.com/miter-framework/miter-sequelize/pulls#fork-destination-box
[whats_new]: https://github.com/miter-framework/miter-sequelize/blob/master/CHANGELOG.md
[browserstack]: https://www.browserstack.com
