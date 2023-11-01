const core = require('@actions/core')
const express = require('express')
const crypto = require('crypto-js')
const fs = require('fs')
const { convert } = require('./convert')

/**
 * The server function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function server() {
  try {
    const app = express()
    const port = process.env.PORT || 3000

    // Configure Express middleware to parse the JSON body and validate the HMAC
    app.use(express.json(), validateHmac)

    app.post('/', async (req, res) => {
      // Send a 200 to tell Terraform Cloud that we recevied the run task
      // Documentation - https://www.terraform.io/cloud-docs/api-docs/run-tasks-integration#run-task-request
      res.sendStatus(200)

      // When a user adds a new run task to their Terraform Cloud organization, Terraform Cloud will attempt to
      // validate the run task address and HMAC by sending a payload with dummy data. This condition will have to be accounted for.
      if (req.body.access_token !== 'test-token') {
        // Segment run tasks based on stage
        if (req.body.stage === 'pre_plan') {
          // Download the config files locally
          // Documentation - https://www.terraform.io/cloud-docs/api-docs/configuration-versions#download-configuration-files
          const {
            configuration_version_download_url,
            access_token,
            organization_name,
            workspace_name,
            run_id,
            task_result_callback_url
          } = req.body
          await downloadConfig(configuration_version_download_url, access_token)
          console.log(
            `Config downloaded for Workspace: ${organization_name}/${workspace_name}, Run: ${run_id} retrieved at ${process.cwd()}!\n`
          )

          // Send the results back to Terraform Cloud
          await scan(task_result_callback_url, access_token)
        } else if (req.body.stage === 'post_plan') {
          // Process the run task request
          // Documentation - https://www.terraform.io/cloud-docs/api-docs/run-tasks-integration#request-body
          const {
            plan_json_api_url,
            access_token,
            organization_name,
            workspace_id,
            run_id,
            task_result_callback_url
          } = req.body
          const planJson = await getPlan(plan_json_api_url, access_token)
          fs.writeFileSync(
            'terraformPlan.json',
            JSON.stringify(planJson, null, 2)
          )
          console.log(
            `Plan ouput for ${organization_name}/${workspace_id}, Run: ${run_id} retrieved!\n}`
          )

          // Send the results back to Terraform Cloud
          await scan(task_result_callback_url, access_token)
        }
      }
    })

    app.listen(port, () => {
      console.log(`Terraform Cloud run task listening on port ${port}`)
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function executeCmds(cmd, task_result_callback_url, access_token) {
  const exec = require('child_process').exec
  await exec(cmd, function (error, stdout, stderr) {
    // Wait for the scanners to finish
    console.log('stdout:', stdout)
    console.log('stderr:', stderr)
    if (error !== null) {
      console.log('exec error:', error)
    }

    // Call the conversion logic (sarif -> runtask)
    const checkovResults = convert('results.sarif')
    let results = checkovResults[0]
    let status = checkovResults[1]
    let totalIssues = checkovResults[2]
    let totalIssueOccurence = checkovResults[3]

    // Append Snyk results if token present
    if (process.env.SNYK_TOKEN) {
      const snykResults = convert('snyk.sarif')

      // Retrieve the scan results
      results = results.concat(snykResults[0])
      status =
        status === 'failed' || snykResults[1] === 'failed' ? 'failed' : 'passed'
      totalIssues = totalIssues + snykResults[2]
      totalIssueOccurence = totalIssueOccurence + snykResults[3]
    }

    // Create the JSON to respond to Terraform Cloud
    const runTaskJSONContent = {
      data: {
        type: 'task-results',
        attributes: {
          status,
          message: `${totalIssues} issues found, total ${totalIssueOccurence} issue occurences`,
          url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_ACTION_REPOSITORY}/actions`
        },
        relationships: {
          outcomes: {
            data: results
          }
        }
      }
    }

    // Respond back to Terraform Cloud
    sendCallback(task_result_callback_url, access_token, runTaskJSONContent)
  })
}

async function scan(task_result_callback_url, access_token) {
  const plan = 'terraformPlan.json'
  const options = '--compact --quiet'
  let cmdBuilder = `docker run --tty --volume ${process.cwd()}:/tf --workdir /tf `
  // Upload results if Prisma Cloud token present
  if (
    process.env.PRISMA_CLOUD_TOKEN &&
    process.env.PRISMA_API_URL &&
    process.env.GITHUB_REPOSITORY
  ) {
    cmdBuilder = cmdBuilder.concat(
      `-e BC_API_KEY="${process.env.PRISMA_CLOUD_TOKEN}" -e PRISMA_API_URL="${process.env.PRISMA_API_URL}" -e REPO_ID="${process.env.GITHUB_REPOSITORY}" `
    )
  }
  cmdBuilder = cmdBuilder.concat(
    `bridgecrew/checkov -f ${plan} ${options} -o sarif; `
  )
  // Scan using Snyk if token present
  if (process.env.SNYK_TOKEN) {
    cmdBuilder = cmdBuilder.concat(
      `docker run --tty --volume ${process.cwd()}:/tf --workdir /tf `
    )
    cmdBuilder = cmdBuilder.concat(
      `-e SNYK_TOKEN=${process.env.SNYK_TOKEN} snyk/snyk:alpine snyk iac test `
    )
    cmdBuilder = cmdBuilder.concat(`${plan} --sarif-file-output=snyk.sarif`)
  }

  console.log(`Running commands -> ${cmdBuilder}`)
  await executeCmds(cmdBuilder, task_result_callback_url, access_token)
}

async function validateHmac(req, res, next) {
  const hmacKey = process.env.HMAC_KEY || 'abc123'
  const computedHmac = crypto
    .HmacSHA512(JSON.stringify(req.body), hmacKey)
    .toString(crypto.enc.Hex)
  const remoteHmac = await req.get('x-tfc-task-signature')
  // If the HMAC validation fails, log the error and send an HTTP Status Code 401, Unauthorized
  // Currently undocumented but 401 is the expected response for an invalid HMAC
  if (computedHmac !== remoteHmac) {
    console.log(`HMAC validation failed. 
        Expected ${remoteHmac} 
        Computed ${computedHmac}`)
    return res.sendStatus(401)
  }
  next()
}

async function sendCallback(callbackUrl, accessToken, payload) {
  const options = {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  }

  const res = await fetch(callbackUrl, options)
  return await res.json()
}

async function getPlan(url, accessToken) {
  const options = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }

  // The first URL returns a 307 Temporary Redirect with the address of the JSON formatted Terraform Plan
  // Documentation - https://www.terraform.io/cloud-docs/api-docs/plans#retrieve-the-json-execution-plan
  // The fetch API follows the redirect by default
  const plan = await fetch(url, options)
  return plan.json()
}

async function downloadConfig(configuration_version_download_url, accessToken) {
  const options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${accessToken}`
    },
    maxRedirects: 20
  }
  const res = await fetch(configuration_version_download_url, options)
  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream('./config.tar.gz')
    res.body.pipe(fileStream)
    res.body.on('error', err => {
      reject(err)
    })
    fileStream.on('finish', function () {
      resolve()
    })
  })
}

module.exports = {
  server
}
