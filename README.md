# Anime Preview ![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Ask Me Anything !](https://img.shields.io/badge/Ask%20me-anything-pink.svg)

![forthebadge](https://forthebadge.com/images/badges/made-with-typescript.svg)
![forthebadge](https://forthebadge.com/images/badges/powered-by-coffee.svg)

## Install

First, clone the repo via git and install dependencies:

```bash
git clone --depth 1 --single-branch https://github.com/InfiniteSynthesis/anime-preview.git your-project-name
cd your-project-name
yarn
```

> If `yarn` returns the error regarding `./lib-cov/fluent-ffmpeg`, just go ahead as it does not matter.

## Starting Development

Start the app in the `dev` environment:

```bash
yarn start
```

## Packaging for Production

To package apps for the local platform:

```bash
yarn package

node_modules/.bin/electron-builder -w nsis
```
