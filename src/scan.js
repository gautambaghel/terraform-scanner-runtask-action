async function downloadCli() {
}

async function scan() {
    var exec  = require('child_process').exec

    child = exec('ls -als',
    function (error, stdout, stderr) {
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);
        if (error !== null) {
        console.log('exec error:', error);
        }
    })
}

module.exports = {
    scan
}
