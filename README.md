# terraform-scanner-runtask-action

[![Lint Code Base](https://github.com/gautambaghel/terraform-scanner-runtask-action/actions/workflows/linter.yml/badge.svg)](https://github.com/gautambaghel/terraform-scanner-runtask-action/actions/workflows/linter.yml)
[![Continuous Integration](https://github.com/gautambaghel/terraform-scanner-runtask-action/actions/workflows/ci.yml/badge.svg)](https://github.com/gautambaghel/terraform-scanner-runtask-action/actions/workflows/ci.yml)

This GitHub action runs Terraform scanners as a Terraform Cloud run task

Currently supports:
  * checkov (runs as default with optional Prisma Cloud integration)
  * snyk (requires a Snyk token)

## Prerequisites

* A Terraform Cloud account [sign up for free here](https://app.terraform.io/public/signup/account)
* A free ngrok account [sign up here](https://dashboard.ngrok.com/signup)
* Ngrok [install docs](https://ngrok.com/docs/getting-started/#step-1-install)
* Terraform workspace (API or CLI only)

## Setup

This GitHub Action uses tunneling via NGROK to expose an endpoint for Terraform Cloud run tasks.

> [!IMPORTANT]
>
> You'll need to run ngrok and the server locally for the first time (**only once**) to verify run task

* A ngrok `domain` & `token` is required for the setup to work > copy the domain & auth token from Ngrok dashboard & save for later use
 
    ![ngrok_setup](images/ngrok.png)

* Run the node server locally for the initial run task setup

  This setup defaults the HMAC key to 'abc123' & port to '3000' for using a different HMAC key set the `HMAC_KEY` and `PORT` env var respectively.

  ```sh
  HMAC_KEY="abc123" PORT="3000" node src/index.js
  ```

  On a different terminal run

  ```sh
  ngrok config add-authtoken <your_token>
  ngrok http --domain='<your_domain>' 3000
  ```

* Create the run task in Terraform Cloud organization settings
  * Go to Terraform Cloud organization settings
  * Click Run Tasks
  * Create the run task with ngrok domain
  * Hit save

    ![terraform_cloud_setup](images/terraform.png)

* Stop the local server and ngrok process

## Usage

* Once you've completed the setup steps above and create a Terraform Cloud workspace with the run task attached, create the GitHub action `ci.yml` file and push

* See below for example invocation of this action, add this to the GitHub repo containing your Terraform code

  ```yaml
  name: Continuous Integration

  on:
    push:
      branches: main

  jobs:
    scan-terraform:
      name: Terraform scan
      runs-on: ubuntu-latest
  
  steps:
    - name: Checkout
      id: checkout
      uses: actions/checkout@v4

    - name: Run my Action
      id: sarif-runtask-action
      uses: gautambaghel/terraform-scanner-runtask-action@v1.0.0-beta
      with:
        ngrok_domain: ${{ secrets.NGROK_DOMAIN }}
        ngrok_authtoken: ${{ secrets.NGROK_TOKEN }}
    
    - uses: hashicorp/tfc-workflows-github/actions/create-run@v1.0.4
      id: run
      continue-on-error: true
      with:
        plan_only: true
        organization: '<YOUR_TERRAFORM_CLOUD_ORG_NAME>'
        workspace: '<YOUR_TERRAFORM_CLOUD_WORKSPACE_NAME>'
        token: '${{ secrets.TFC_API_TOKEN }}'
  ```

* For a more complete example refer to [example-ci.yml](examples/example-ci.yml) file

### Building Setup locally

After you've cloned the repository to your local machine or codespace, you'll
need to perform some initial setup steps before you can develop your action.

1. :hammer_and_wrench: Install the dependencies

   ```bash
   npm install
   ```

2. :building_construction: Package the JavaScript for distribution

   ```bash
   npm run bundle
   ```

3. :white_check_mark: Run the tests

   ```bash
   $ npm test

   PASS  ./index.test.js
    index
      ✓ calls run when imported (2 ms)

   ...
   ```

### Limitations

* Run task endpoint validation needs to happen locally for the first run
* Terraform cloud workflows can only work through GitHub Action
