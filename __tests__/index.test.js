/**
 * Unit tests for the action's entrypoint, src/index.ts
 */

const { server } = require('../src/server')

// Mock the action's entrypoint
jest.mock('../src/server', () => ({
  server: jest.fn()
}))

describe('index', () => {
  it('calls run when imported', async () => {
    require('../src/index')

    expect(server).toHaveBeenCalled()
  })
})
