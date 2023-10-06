/**
 * Unit tests for the action's main functionality, src/main.js
 */
const core = require('@actions/core')
const main = require('../src/main')

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug').mockImplementation()
const getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
const setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('check if output filename provided', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'sarif-filename':
          return 'examples/input.sarif'
        case 'runtask-filename':
          return 'examples/output.json'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()
    expect(debugMock).toHaveBeenNthCalledWith(
      1,
      'Output file used: examples/output.json'
    )
    expect(debugMock).toHaveBeenNthCalledWith(2, 'Issues count: 7')
    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'runtask-filename',
      'examples/output.json'
    )
  })

  it('fail if output not correct', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'sarif-filename':
          return 'examples/input.sarif'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()
    expect(debugMock).toHaveBeenNthCalledWith(
      1,
      'Output file used: examples/output.json'
    )
    expect(debugMock).toHaveBeenNthCalledWith(2, 'Issues count: 7')
    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'runtask-filename',
      'examples/output.json'
    )
  })

  it('fails if no input is provided', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'sarif-filename':
          throw new Error('Input required and not supplied: sarif-filename')
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Input required and not supplied: sarif-filename'
    )
  })
})
