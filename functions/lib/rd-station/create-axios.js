const axios = require('axios')
module.exports = (accessToken, isSandbox) => {

  const headers = {
    'content-type': 'application/json',
    accept: 'application/json'
  }
  if (accessToken) {
    console.log('> token ', accessToken)
    headers.Authorization = `Bearer ${accessToken}`
  }

  return axios.create({
    baseURL: `https://api.rd.services`,
    headers
  })
}
