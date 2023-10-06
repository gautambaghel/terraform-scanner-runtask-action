const core = require('@actions/core')
const fs = require('fs')

// Returns the issue label, level and numeric value respectively
// based on the acceptable input in Terraform Cloud
const getImpactArray = impact => {
  switch (impact) {
    case 'error':
      return ['High', 'error', 3]
    case 'warning':
      return ['Medium', 'warning', 2]
    case 'note':
      return ['Low', 'info', 1]
    default:
      return ['Info', 'none', 0]
  }
}

const getStatusFromLevel = status => {
  switch (status) {
    case 3:
      return 'failed'
    case 2:
      return 'failed'
    case 1:
      return 'passed'
    default:
      return 'passed'
  }
}

const getDescription = (shortDescription, fullDescription, help) => {
  if (shortDescription && shortDescription.text) {
    return shortDescription.text
  } else if (fullDescription && fullDescription.text) {
    return fullDescription.text
  } else if (help && help.text) {
    return help.text
  } else {
    return 'No description for this issue'
  }
}

const getBodyFromResults = (id, resultInstances) => {
  let body = ''
  const resultsArray = resultInstances.filter(result => result.ruleId === id)

  for (let i = 0; i < resultsArray.length; i++) {
    const locations = resultsArray[i].locations
    for (let j = 0; j < locations.length; j++) {
      let builder = `### Issue in ${resultsArray[i].locations[j].physicalLocation.artifactLocation.uri} file `
      builder = builder.concat(
        `starting from **${resultsArray[i].locations[j].physicalLocation.region.startLine}** `
      )
      builder = builder.concat(
        `ending at **'${resultsArray[i].locations[j].physicalLocation.region.endLine}** `
      )
      builder = builder.concat(
        '\n\n```\n',
        resultsArray[i].locations[j].physicalLocation.region.snippet.text,
        '\n```\n'
      )

      body = body.concat(builder, '\n\n')
    }
  }

  return body
}

const convertSarifFileToRunTaskFile = (inputFileName, outputFileName) => {
  let results = {}

  const rawdata = fs.readFileSync(inputFileName)
  results = JSON.parse(rawdata)
  console.log(
    'Pipeline Scan results file found and parsed - validated JSON file'
  )

  const rules = results.runs[0].tool.driver.rules
  console.log(`Issues count: ${rules.length}`)
  core.debug(`Issues count: ${rules.length}`)

  const resultInstances = results.runs[0].results
  console.log(`Total issue instance count: ${resultInstances.length}`)

  let overallStatusLevel = 0

  // convert to structure run tasks json
  const sRunTaskResults = rules.map(rule => {
    // get the severity according to SARIF
    const impactInfoArray = getImpactArray(rule.defaultConfiguration.level)
    const severityLabel = impactInfoArray[0]
    const severityLevel = impactInfoArray[1]
    const severityNum = impactInfoArray[2]
    // set the overall status to the highest level of issue
    if (severityNum > overallStatusLevel) {
      core.debug(
        `Current impact status: ${getStatusFromLevel(overallStatusLevel)}`
      )
      overallStatusLevel = severityNum
    }
    // get description from either of the 3 sequentially
    const description = getDescription(
      rule.shortDescription,
      rule.fullDescription,
      rule.help
    )
    const body = getBodyFromResults(rule.id, resultInstances, description)
    // populate issue
    const resultItem = {
      type: 'task-result-outcomes',
      attributes: {
        'outcome-id': rule.id,
        description,
        tags: {
          Severity: [
            {
              label: severityLabel,
              level: severityLevel
            }
          ]
        },
        body,
        url: rule.helpUri
      }
    }
    return resultItem
  })

  const status = getStatusFromLevel(overallStatusLevel)
  // construct the full SARIF content
  const runTaskJSONContent = {
    data: {
      type: 'task-results',
      attributes: {
        status,
        message: `${rules.length} issues found`,
        url: results.runs[0].tool.driver.informationUri
      },
      relationships: {
        outcomes: {
          data: sRunTaskResults
        }
      }
    }
  }

  // save to file
  fs.writeFileSync(outputFileName, JSON.stringify(runTaskJSONContent, null, 2))
  console.log(`Run Task output file created: ${outputFileName}`)
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const sarifInputFileName = core.getInput('sarif-filename', {
      required: true
    })
    let sRunTaskOutputFileName = core.getInput('runtask-filename', {
      required: false
    })
    if (!sRunTaskOutputFileName) {
      sRunTaskOutputFileName = 'examples/output.json'
      core.debug('Output file used: examples/output.json')
    } else {
      core.debug(`Output file used: ${sRunTaskOutputFileName}`)
    }

    convertSarifFileToRunTaskFile(sarifInputFileName, sRunTaskOutputFileName)
    core.setOutput('runtask-filename', sRunTaskOutputFileName)
  } catch (error) {
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
