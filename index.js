const core = require('@actions/core');
const fs = require('fs');

const sarifInputFileName = core.getInput('sarif-results');
const sRunTaskOutputFileName = core.getInput('runtask-results');

// none,info,warning,error
const impactToLevel = (impact => {
    switch (impact) {
        case "error":
            return "error";
        case "warning":
            return "warning";
        case "note":
            return "info";
        default:
            return "none";
    }
})

// High,Medium,Low,Info
const impactToLabel = (impact => {
    switch (impact) {
        case "error":
            return "High";
        case "warning":
            return "Medium";
        case "note":
            return "Low";
        default:
            return "Info";
    }
})

const levelToStatus = (status => {
    switch (status) {
        case "error":
            return "failed";
        case "warning":
            return "passed";
        case "note":
            return "passed";
        default:
            return "passed";
    }
})

const getDescription = (sd, fd, help) => {
    if (sd !== "") {
        return sd;
    } else if (fd !== "") {
        return fd;
    } else if (help !== "") {
        return help;
    } else {
        return "No description for this issue"
    }
}

const getBodyFromResults = (id, resultInstances) => {
    var body = ""
    let resultsArray = resultInstances.filter(result => result.ruleId === id);

    for (let i = 0; i < resultsArray.length; i++) {
        let locations = resultsArray[i].locations
        for (let j = 0; j < locations.length; j++) {
            var builder = "### Issue in " + resultsArray[i].locations[j].physicalLocation.artifactLocation.uri + " file \n "
            builder = builder + "starting from `" + resultsArray[i].locations[j].physicalLocation.region.startLine + "` \n "
            builder = builder + "ending at `" + resultsArray[i].locations[j].physicalLocation.region.endLine + "` \n "
            builder = builder + "\n " + resultsArray[i].locations[j].physicalLocation.region.snippet.text

            body = body + builder + "\n "
        }
    }

    return body;
}

const convertSarifFileToRunTaskFile = (inputFileName, outputFileName) => {
    var results = {};

    let rawdata = fs.readFileSync(inputFileName);
    results = JSON.parse(rawdata);
    console.log('Pipeline Scan results file found and parsed - validated JSON file');

    let rules = results.runs[0].tool.driver.rules;
    console.log('Issues count: ' + rules.length);

    let resultInstances = results.runs[0].results;
    console.log('Total issue instance count: ' + resultInstances.length);

    // convert to structure run tasks json
    let sRunTaskResults = rules.map(rule => {

        // get the severity according to SARIF
        let sarLevel = impactToLevel(rule.defaultConfiguration.level);
        let sarLabel = impactToLabel(rule.defaultConfiguration.level);
        let description = getDescription(rule.shortDescription, rule.fullDescription, rule.help);
        let body = getBodyFromResults(rule.id, resultInstances);

        // populate issue
        let resultItem = {
            "outcome-id": rule.id,
            description: description,
            tags: {
                Status: [
                    {
                        label: sarLabel,
                        level: sarLevel
                    }
                ],
                Severity: [
                    {
                        label: sarLabel,
                        level: sarLevel
                    },
                ]
            },
            body: body,
            url: rule.helpUri
        }
        return resultItem;
    })

    let status = levelToStatus(results.runs[0].results[0].level)
    // construct the full SARIF content
    let sarifFileJSONContent = {
        data: {
            type: "task-results",
            attributes: {
                status: status,
                message: rules.length + " issues found",
                url: results.runs[0].tool.driver.informationUri,
            },
            relationships: {
                outcomes: {
                    data: sRunTaskResults
                }
            }
        }
    };

    // save to file
    fs.writeFileSync(outputFileName, JSON.stringify(sarifFileJSONContent, null, 2));
    console.log('Run Task output file created: ' + outputFileName);
}

try {
    convertSarifFileToRunTaskFile(sarifInputFileName, sRunTaskOutputFileName);
} catch (error) {
    core.setFailed(error.message);
}

module.exports = {
    convertToSarif: convertSarifFileToRunTaskFile
}
