module.exports = (client_id, client_secret, code, storeId, refresh_token) => new Promise((resolve, reject) => {
  //  https://developers.rdstation.com/reference/gerar-code
  const axios = require('./create-axios')(null)
  const request = isRetry => {
    const path = refresh_token ? '/auth/token' : `/auth/token?code=${code}`
    console.log(`>> Create Auth path:${storeId}: ${path}`)
    axios.post(path, {
      client_id,
      client_secret,
      refresh_token
    })
      .then(({ data }) => resolve(data))
      .catch(err => {
        console.log('Deu erro', JSON.stringify(err))
        // console.log('Deu erro quero response status', err.response.status)
        if (!isRetry && err.response && err.response.status >= 429) {
          setTimeout(() => request(true), 7000)
        }
        reject(err)
      })
  }
  request()
})

