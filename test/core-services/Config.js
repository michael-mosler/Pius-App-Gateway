const expect = require('expect');
const dateTime = require('date-and-time');
const Config = require('../../server/core-services/Config');

describe('Config.simDate', () => {
  it('should simdate correctly', () => {
    const config = new Config();
    config.simDate = '20200321';
    const simDate = config.simDate;
    expect(dateTime.format(simDate, 'YYYYMMDD')).toEqual('20200321');
  });

  it('should throw on unexpected format', () => {
    const config = new Config();
    try {
      config.simDate = '20321';
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toEqual('Invalid Date');
    }

    try {
      config.simDate = 'AABBCC';
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toEqual('Invalid Date');
    }

    try {
      config.simDate = '20200230';
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toEqual('Invalid Date');
    }
  });
});
