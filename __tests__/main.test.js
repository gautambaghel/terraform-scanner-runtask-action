/**
 * Unit tests for the action's convert functionality, src/convert.js
 */
const core = require('@actions/core')
const convert = require('../src/convert')

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug').mockImplementation()

// Mock the action's convert function
const runMock = jest.spyOn(convert, 'convert')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('check if checkov coversion logic is working', async () => {
    await convert.convert('examples/checkov.sarif')
    expect(runMock).toHaveReturned()
    expect(debugMock).toHaveBeenNthCalledWith(1, 'Unique issues count: 7')
    expect(debugMock).toHaveBeenNthCalledWith(
      2,
      'Current impact status: passed'
    )
  })

  it('check if snyk coversion logic is working', async () => {
    await convert.convert('examples/snyk.sarif')
    expect(runMock).toHaveReturned()
    expect(debugMock).toHaveBeenNthCalledWith(1, 'Unique issues count: 6')
  })
})
