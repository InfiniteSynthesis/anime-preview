# Anime Preview ![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Ask Me Anything !](https://img.shields.io/badge/Ask%20me-anything-pink.svg)

![forthebadge](https://forthebadge.com/images/badges/made-with-typescript.svg)
![forthebadge](https://forthebadge.com/images/badges/powered-by-coffee.svg)


## Introduction

Anime Preview is a tool for managing local anime Blue-Ray resources.

## Install

First, clone the repo via git and install dependencies:

```bash
git clone --depth 1 --single-branch https://github.com/InfiniteSynthesis/anime-preview.git your-project-name
cd your-project-name
yarn
```

## Starting Development

Start the app in the `dev` environment:

```bash
yarn start
```

## Packaging for Production

To package apps for the local platform:

- Mac:

```bash
yarn package
```

- Win:

```
yarn build
node_modules/.bin/electron-builder -w nsis
```
