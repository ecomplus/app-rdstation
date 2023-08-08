module.exports = (client_id, client_secret, code, refresh_token, storeId, isSandbox) => new Promise((resolve, reject) => {
  //  https://developer.fedex.com/api/en-in/catalog/authorization/docs.html#operation/API%20Authorization
  let accessToken
  const axios = require('./create-axios')(accessToken, isSandbox)
  const request = isRetry => {
    const path = refresh_token ? '/auth/token' : `/auth/token?code=${code}`
    console.log(`>> Create Auth s:${storeId}--Sandbox: ${isSandbox}`)
    axios.post(path, {
      client_id,
      client_secret,
      refresh_token
    })
      .then(({ data }) => resolve(data))
      .catch(err => {
        if (!isRetry && err.response && err.response.status >= 429) {
          setTimeout(() => request(true), 7000)
        }
        reject(err)
      })
  }
  request()
})
