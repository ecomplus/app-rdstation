// read configured E-Com Plus app data
const getAppData = require('./../../lib/store-api/get-app-data')
const RdAxios = require('./../../lib/rd-station/create-access')

const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

exports.post = ({ appSdk }, req, res) => {
  // receiving notification from Store API
  const { storeId } = req

  /**
   * Treat E-Com Plus trigger body here
   * Ref.: https://developers.e-com.plus/docs/api/#/store/triggers/
   */
  const trigger = req.body
  console.log('Trigger from: ', storeId)
  // get app configured options
  getAppData({ appSdk, storeId })
    .then(appData => {
      if (
        Array.isArray(appData.ignore_triggers) &&
        appData.ignore_triggers.indexOf(trigger.resource) > -1
      ) {
        // ignore current trigger
        const err = new Error()
        err.name = SKIP_TRIGGER_NAME
        throw err
      }
      const { client_id, client_secret, code } = appData

      console.log('Get app data:', client_id, client_secret, code)

      if (!client_id && !client_secret) {
        return res.status(409).send({
          error: 'NO_RD_KEYS',
          message: 'Client id ou secret não configurado'
        })
      }

      const rdAxios = new RdAxios(client_id, client_secret, code, storeId)

      /* DO YOUR CUSTOM STUFF HERE */
      const { resource } = trigger
      console.log('o recurso é:', resource)
      if ((resource === 'orders' || resource === 'carts') && trigger.action !== 'delete') {
        const resourceId = trigger.resource_id || trigger.inserted_id
        if (resourceId) {
          console.log(`Trigger for Store #${storeId} ${resourceId} => ${url}`)
          if (url) {
            appSdk.apiRequest(storeId, `${resource}/${resourceId}.json`)
              .then(async ({ response }) => {
                let customer
                const body = response.data
                if (resource === 'carts') {
                  const cart = body
                  if (cart.available && !cart.completed) {
                    const abandonedCartDelay = 2 * 1000 * 60
                    if (Date.now() - new Date(cart.created_at).getTime() >= abandonedCartDelay) {
                      const { customers } = cart
                      if (customers && customers[0]) {
                        const { response } = await appSdk.apiRequest(storeId, `customers/${customers[0]}.json`)
                        customer = response.data
                      }
                    } else {
                      return res.sendStatus(501)
                    }
                  } else {
                    return res.sendStatus(204)
                  }
                }
                if (resource === 'orders') {
                  const { buyers } = body
                  if (buyers && buyers[0]) {
                    const { response } = await appSdk.apiRequest(storeId, `customers/${buyers[0]}.json`)
                    customer = response.data
                  }
                }
                console.log(`> Sending ${resource} notification`)
                let data
                if (resource === 'orders') {
                  const financial = body && body.financial_status.current
                  
                  const transaction = body.transactions[0]
                  const getMethod = transaction => {
                    const paymentMethod = transaction.payment_method && transaction.payment_method.code
                    if (paymentMethod === 'credit_card') {
                      return 'Credit Card'
                    } else {
                      return 'Others'
                    }
                  }
                  const paymentMethod = getMethod(transaction)
                  const total = body.amount && body.amount.total
                  const acceptedMarketing = body.accepts_marketing ? 'granted' : 'declined'
                  data = {
                    "event_type": "ORDER_PLACED",
                    "event_family":"CDP",
                    "payload": {
                      "name": customer.display_name,
                      "email": customer.main_email,
                      "cf_order_id": body._id,
                      "cf_order_total_items": totalItems,
                      "cf_order_status": financial,
                      "cf_order_payment_method": paymentMethod,
                      "cf_order_payment_amount": total,
                      "legal_bases": [
                        {
                          "category": "communications",
                          "type":"consent",
                          "status": acceptedMarketing
                        }
                      ]
                    }
                  }
                } else if (resource === 'carts') {
                  const totalItems = body.items.length
                  const acceptedMarketing = body.accepts_marketing ? 'granted' : 'declined'
                  data = {
                    "event_type": "CART_ABANDONED",
                    "event_family":"CDP",
                    "payload": {
                      "name": customer.display_name,
                      "email": customer.main_email,
                      "cf_cart_id": body._id,
                      "cf_cart_total_items": totalItems,
                      "cf_cart_status": "in_progress",
                      "legal_bases": [
                        {
                          "category": "communications",
                          "type": "consent",
                          "status": acceptedMarketing
                        }
                      ]
                    }
                  }
                }
                rdAxios.preparing
                  .then(() => {
                    const { axios } = rdAxios
                    console.log('> Send resource', JSON.stringify(data), ' <<')
                    // https://axios-http.com/ptbr/docs/req_config
                    const validateStatus = function (status) {
                      return status >= 200 && status <= 301
                    }
                    return axios.post('/platform/events', data, { 
                      maxRedirects: 0,
                      validateStatus
                    })
                  })
                  .then(({ status }) => {
                    console.log(`> ${status} - Created ${resource} - ${resourceId} - ${storeId}`)
                  })
                  .catch(error => {
                    if (error.response && error.config) {
                      const err = new Error(`#${storeId} ${resourceId} POST to ${url} failed`)
                      const { status, data } = error.response
                      err.response = {
                        status,
                        data: JSON.stringify(data)
                      }
                      err.data = JSON.stringify(error.config.data)
                      return console.error(err)
                    }
                    console.error(error)
                  })
                  .finally(() => {
                    if (!res.headersSent) {
                      return res.sendStatus(200)
                    }
                  })
              })
          }
        }
      }
    
      if (resource !== 'carts') {
        res.sendStatus(201)
      }
    })

    .catch(err => {
      console.log('erro para buscar o app')
      if (err.name === SKIP_TRIGGER_NAME) {
        // trigger ignored by app configuration
        res.send(ECHO_SKIP)
      } else if (err.appWithoutAuth === true) {
        const msg = `Webhook for ${storeId} unhandled with no authentication found`
        const error = new Error(msg)
        error.trigger = JSON.stringify(trigger)
        console.error(error)
        res.status(412).send(msg)
      } else {
        // console.error(err)
        // request to Store API with error response
        // return error status code
        res.status(500)
        const { message } = err
        res.send({
          error: ECHO_API_ERROR,
          message
        })
      }
    })
}
