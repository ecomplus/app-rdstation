const axios = require('axios')
module.exports = (accessToken, isSandbox) => {

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
  if (accessToken) {
    console.log('> token ', accessToken)
    headers.Authorization = `Bearer ${accessToken}`
  }

  return axios.create({
    baseURL: `https://apis.${isSandbox ? 'sandbox.' : ''}fedex.com`,
    headers
  })
}
