const getAppData = require('./../../lib/store-api/get-app-data')
const RdAxios = require('./../../lib/rd-stations/create-access')

const findOrderById = (appSdk, storeId, auth, orderId) => {
  return new Promise((resolve, reject) => {
    appSdk.apiRequest(storeId, `/orders/${orderId}.json`, 'GET', null, auth)
      .then(({ response }) => {
        resolve(response.data)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

const parseStatusToEcom = (pagaleveTransactionStatus) => {
  switch (pagaleveTransactionStatus.toLowerCase()) {
    case 'pending':
    case 'new':
    case 'accepted':
      return 'pending'

    case 'authorized':
    case 'completed':
      return 'paid'

    case 'expired':
    case 'DECLINED':
    case 'ABANDONED':
    case 'canceled':
      return 'voided'
  }
  return 'unknown' // INTERNAL_ERROR
}

exports.post = ({ appSdk, admin }, req, res) => {
  console.log('>>Webhook RD: ')
  const { body, query } = req
  let { storeId } = query
  storeId = parseInt(storeId, 10)
  const {
    id,
    orderReference,
    state,
    amount
  } = body
  console.log('>> Store: ', storeId, ' body: ', JSON.stringify(body), ' <<')
  if (storeId > 100) {
    res.status(200).send(body)
    return appSdk.getAuth(storeId)
      .then(async (auth) => {
        try {
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
                  const rdAxios = RdAxios(appData.client_id, appData.client_secret, false, storeId)
                  rdAxios.preparing
                    .then(() => {
                      const { axios } = rdAxios
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
  } else {
    return res.send({
      status: 404,
      msg: `StoreId #${storeId} not found`
    })
  }
}
