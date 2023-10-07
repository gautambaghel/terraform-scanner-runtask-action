const core = require('@actions/core')
const fs = require('fs')

let overallStatusLevel = 0

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
  let builder = ''
  const resultsArray = resultInstances.filter(result => result.ruleId === id)

  for (let i = 0; i < resultsArray.length; i++) {
    if (resultsArray[i]?.locations) {
      const locations = resultsArray[i].locations
      for (let j = 0; j < locations.length; j++) {
        if (
          resultsArray[i]?.locations[j]?.physicalLocation?.artifactLocation?.uri
        ) {
          builder = builder.concat(
            `### Issue in ${resultsArray[i].locations[j].physicalLocation.artifactLocation.uri} file `
          )
        }
        if (
          resultsArray[i]?.locations[j]?.physicalLocation?.region?.startLine
        ) {
          builder = builder.concat(
            `starting from **${resultsArray[i].locations[j].physicalLocation.region.startLine}** `
          )
        }
        if (resultsArray[i]?.locations[j]?.physicalLocation?.region?.endLine) {
          builder = builder.concat(
            `ending at **'${resultsArray[i].locations[j].physicalLocation.region.endLine}** `
          )
        }
        if (
          resultsArray[i]?.locations[j]?.physicalLocation?.region?.snippet?.text
        ) {
          builder = builder.concat(
            '\n\n```\n',
            resultsArray[i].locations[j].physicalLocation.region.snippet.text,
            '\n```\n'
          )
        }

        builder = builder.concat(builder, '\n\n')
      }
    }
  }

  return builder
}

const convertSarifRuleToRunTaskBlock = (
  inputFileName,
  rules,
  resultInstances
) => {
  // convert to structure run tasks json
  const sRunTaskResults = rules.map(rule => {
    // get the severity according to SARIF
    const impactArray = getImpactArray(rule.defaultConfiguration.level)
    const severityLabel = impactArray[0]
    const severityLevel = impactArray[1]
    const severityNum = impactArray[2]
    // set the overall status to the highest level of issue
    if (severityNum > overallStatusLevel) {
      core.debug(
        `Current impact status: ${getStatusFromLevel(overallStatusLevel)}`
      )
      console.log(
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

    let body
    if (inputFileName.includes('snyk.sarif') && rule?.help?.markdown) {
      body = rule.help.markdown
    } else {
      body = getBodyFromResults(rule.id, resultInstances)
    }

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

  return sRunTaskResults
}

/**
 * The main function
 */
function run(sarifInputFileName) {
  let results = {}

  const rawdata = fs.readFileSync(sarifInputFileName)
  results = JSON.parse(rawdata)
  console.log(
    'Pipeline Scan results file found and parsed - validated JSON file'
  )

  const rules = results.runs[0].tool.driver.rules
  console.log(`Unique issues count: ${rules.length}`)
  core.debug(`Unique issues count: ${rules.length}`)

  const resultInstances = results.runs[0].results
  console.log(`Total issues present: ${resultInstances.length}`)

  const runTaskBlock = convertSarifRuleToRunTaskBlock(
    sarifInputFileName,
    rules,
    resultInstances
  )
  // construct the full SARIF content
  const status = getStatusFromLevel(overallStatusLevel)
}

module.exports = {
  run
}
