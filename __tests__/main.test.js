/**
 * Unit tests for the action's main functionality, src/main.js
 */
const core = require('@actions/core')
const main = require('../src/main')

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug').mockImplementation()

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('check if checkov coversion logic is working', async () => {
    await main.run('examples/checkov.sarif', 'examples/output.json')
    expect(runMock).toHaveReturned()
    expect(debugMock).toHaveBeenNthCalledWith(1, 'Unique issues count: 7')
    expect(debugMock).toHaveBeenNthCalledWith(
      2,
      'Current impact status: passed'
    )
  })

  it('check if snyk coversion logic is working', async () => {
    await main.run('examples/snyk.sarif', 'examples/output.json')
    expect(runMock).toHaveReturned()
    expect(debugMock).toHaveBeenNthCalledWith(1, 'Unique issues count: 6')
    expect(debugMock).toHaveBeenNthCalledWith(
      2,
      'Current impact status: passed'
    )
  })
})
