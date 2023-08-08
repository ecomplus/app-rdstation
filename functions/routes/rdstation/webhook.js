const getAppData = require('./../../lib/store-api/get-app-data')

exports.post = ({ appSdk, admin }, req, res) => {
  console.log('>>Webhook RD: ')
  const { body, query } = req
  let { storeId } = query
  storeId = parseInt(storeId, 10)
  console.log('>> Store: ', storeId, ' body: ', JSON.stringify(body), ' <<')
  if (storeId > 100) {
    res.status(200).send(body)
    return appSdk.getAuth(storeId)
      .then(async (auth) => {
        try {
          
        } catch (error) {
          console.error(error)
          const { response, config } = error
          let status
          if (response) {
            status = response.status
            const err = new Error(`#${storeId} Pagalve Webhook error ${status}`)
            err.url = config && config.url
            err.status = status
            err.response = JSON.stringify(response.data)
            console.error(err)
          }
          if (!res.headersSent) {
            res.send({
              status: status || 500,
              msg: `#${storeId} Pagaleve Webhook error`
            })
          }
        }
      })
      .catch(() => {
        console.log('Unauthorized')
        if (!res.headersSent) {
          res.sendStatus(401)
        }
      })
  } 
}
