# sarif-results-to-runtask

[![Lint Code Base](https://github.com/gautambaghel/sarif-results-to-runtask/actions/workflows/linter.yml/badge.svg)](https://github.com/gautambaghel/sarif-results-to-runtask/actions/workflows/linter.yml)
[![Continuous Integration](https://github.com/gautambaghel/sarif-results-to-runtask/actions/workflows/ci.yml/badge.svg)](https://github.com/gautambaghel/sarif-results-to-runtask/actions/workflows/ci.yml)

This code converts SARIF results to structured Terraform Cloud run task outputs

## Initial Setup

After you've cloned the repository to your local machine or codespace, you'll
need to perform some initial setup steps before you can develop your action.

> [!NOTE]
>
> You'll need to have a reasonably modern version of
> [Node.js](https://nodejs.org) handy. If you are using a version manager like
> [`nodenv`](https://github.com/nodenv/nodenv) or
> [`nvm`](https://github.com/nvm-sh/nvm), you can run `nodenv install` in the
> root of your repository to install the version specified in
> [`package.json`](./package.json). Otherwise, 20.x or later should work!

1. :hammer_and_wrench: Install the dependencies

   ```bash
   npm install
   ```

1. :building_construction: Package the JavaScript for distribution

   ```bash
   npm run bundle
   ```

1. :white_check_mark: Run the tests

   ```bash
   $ npm test

   PASS  ./index.test.js
     ✓ throws invalid number (3ms)
     ✓ wait 500 ms (504ms)
     ✓ test runs (95ms)

   ...
   ```

### Run this Action locally

```
node src/index.js
```

## Usage

To include the action in a workflow in another repository, you can use the
`uses` syntax with the `@` symbol to reference a specific branch, tag, or commit
hash.

```yaml
steps:
  - name: Checkout
    id: checkout
    uses: actions/checkout@v4

  - name: Run my Action
    id: sarif-runtask-action
    uses: gautambaghel/sarif-results-to-runtask@v1 # Commit with the `v1` tag
    with:
      sarif-filename: 'examples/input.sarif'

  - name: Streamlines run task output format
    id: output
    run: cat "${{ steps.sarif-runtask-action.outputs.runtask-filename }}"
```
