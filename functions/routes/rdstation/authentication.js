const getAppData = require('./../../lib/store-api/get-app-data')
const updateAppData = require('./../../lib/store-api/update-app-data')

exports.post = ({ appSdk, admin }, req, res) => {
  console.log('>>Webhook RD: POST')
  const { body, query } = req
  let { storeId, code } = query
  storeId = parseInt(storeId, 10)
  console.log('>> Store: ', storeId, ' body: ', JSON.stringify(body), ' <<')
  if (storeId > 100) {
    res.status(200).send(body)
    return appSdk.getAuth(storeId)
      .then(async (auth) => {
        try {
          // getAppData({ appSdk, storeId, auth }).then()
          /* 
          const order = await findOrderById(appSdk, storeId, auth, orderReference)
          if (order) {
            // update payment
            const transactionId = order.transactions[0]._id
            let body = {
              date_time: new Date().toISOString(),
              status: parseStatusToEcom(state),
              transaction_id: transactionId,
              flags: ['Pagaleve']
            }
            const responsePaymentHistory = await appSdk.apiRequest(
              storeId,
              `orders/${order._id}/payments_history.json`,
              'POST',
              body,
              auth
            )
            if (responsePaymentHistory) {
              console.log('> Transaction Code Pagaleve <')
              body = {
                intermediator: {
                  transaction_id: id || '',
                  transaction_code: id || ''
                }
              }
            }
            const responseUpdateTransaction = await appSdk.apiRequest(
              storeId,
              `orders/${order._id}/transactions/${transactionId}.json`,
              'PATCH',
              body,
              auth
            )
            if (responseUpdateTransaction) {
              console.log('> UPDATE Transaction OK')
            }
            if (state.toLowerCase() === 'authorized') {
              getAppData({ appSdk, storeId, auth })
                .then(appData => {
                  pagaleveAxios.preparing
                    .then(() => {
                      const { axios } = pagaleveAxios
                      let body = {
                        checkout_id: id,
                        currency: 'BRL',
                        amount,
                        intent: 'CAPTURE'
                      }
                      console.log('> SendPayment Pagaleve: ', JSON.stringify(body), ' <<')
                      // https://axios-http.com/ptbr/docs/req_config
                      const validateStatus = function (status) {
                        return status >= 200 && status <= 301
                      }
                      return axios.post('/v1/payments', body, { 
                        maxRedirects: 0,
                        validateStatus
                      })
                    })
                    .then(({ data }) => {
                      console.log('>> Created payment <<', JSON.stringify(data))
                    })
                    .catch(error => {console.log('erro', error)})
                })
            }
          }
         */} catch (error) {
          console.error(error)
          const { response, config } = error
          let status
          if (response) {
            status = response.status
            const err = new Error(`#${storeId} RD Stations Webhook error ${status}`)
            err.url = config && config.url
            err.status = status
            err.response = JSON.stringify(response.data)
            console.error(err)
          }
          if (!res.headersSent) {
            res.send({
              status: status || 500,
              msg: `#${storeId} RD Webhook error`
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
  } else {
    return res.send({
      status: 404,
      msg: `StoreId #${storeId} not found`
    })
  }
}

exports.get = ({ appSdk, admin }, req, res) => {
  console.log('>>Webhook RD: GET')
  const { body, query } = req
  let { storeId, code } = query
  storeId = parseInt(storeId, 10)
  console.log('>> Store: ', storeId, ' code: ', code, ' <<')
  if (storeId > 100) {
    res.status(200).redirect('https://app.e-com.plus/#/apps/edit/111968/')
  }
}
