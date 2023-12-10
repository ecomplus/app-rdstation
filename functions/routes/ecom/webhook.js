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

  const validateStatus = function (status) {
    return status >= 200 && status <= 301
  }

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

      if (!client_id && !client_secret) {
        return res.status(409).send({
          error: 'NO_RD_KEYS',
          message: 'Client id ou secret não configurado'
        })
      }

      const rdAxios = new RdAxios(client_id, client_secret, code, storeId)

      /* DO YOUR CUSTOM STUFF HERE */
      const { resource } = trigger
      if ((resource === 'orders' || resource === 'carts' || resource === 'customers') && trigger.action !== 'delete') {
        const resourceId = trigger.resource_id || trigger.inserted_id
        if (resourceId) {
          console.log(`Trigger for Store #${storeId} ${resource} ${resourceId}`)
          appSdk.apiRequest(storeId, `${resource}/${resourceId}.json`)
            .then(async ({ response }) => {
                let customer
                const body = response.data
                if (resource === 'carts') {
                  const cart = body
                  if (cart.available && !cart.completed) {
                    const { customers } = cart
                    if (customers && customers[0]) {
                      const { response } = await appSdk.apiRequest(storeId, `customers/${customers[0]}.json`)
                      customer = response.data
                    }
                  } else {
                    return res.sendStatus(204)
                  }
                } else if (resource === 'orders') {
                  const { buyers } = body
                  if (buyers && buyers.length && buyers[0]) {
                    const { response } = await appSdk.apiRequest(storeId, `customers/${buyers[0]._id}.json`)
                    customer = response.data
                  }
                }
                console.log(`> Sending ${resource} notification`)
                let data, items
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
                    items = body.items
                    data = {
                      "event_type": "ORDER_PLACED",
                      "event_family":"CDP",
                      "payload": {
                        "name": customer.display_name,
                        "email": customer.main_email,
                        "cf_order_id": body._id,
                        "cf_order_total_items": items && items.length || 0,
                        "cf_order_status": financial,
                        "cf_order_payment_method": paymentMethod,
                        "cf_order_payment_amount": total,
                        "legal_bases": [
                          {
                            "category": "communications",
                            "type":"consent",
                            "status": body.accepts_marketing !== false ? 'granted' : 'declined'
                          }
                        ]
                      }
                    }
                } else if (resource === 'carts') {
                  items = body.items
                  data = {
                    "event_type": "CART_ABANDONED",
                    "event_family":"CDP",
                    "payload": {
                      "name": customer.display_name,
                      "email": customer.main_email,
                      "cf_cart_id": body._id,
                      "cf_cart_total_items": items && items.length || 0,
                      "cf_cart_status": "in_progress",
                      "legal_bases": [
                        {
                          "category": "communications",
                          "type": "consent",
                          "status": body.accepts_marketing !== false ? 'granted' : 'declined'
                        }
                      ]
                    }
                  }
                } else if (resource === 'customers') {
                  const cellphone = body.phones && body.phones.length && body.phones[0] && body.phones[0].number
                  const phoneWithLocale = cellphone && cellphone.length ? `+55${cellphone}` : undefined
                  const birthDate = body.birth_date && body.birth_date.day && body.birth_date.month && body.birth_date.year ? `${body.birth_date.year}/${body.birth_date.month.padStart(2, '0')}/${body.birth_date.day.padStart(2, '0')}` : undefined
                  const address = body.addresses && body.addresses.length && body.addresses[0]
                  const city = address ? address.city : undefined
                  const state = address ? address.province_code : undefined
                  data = {
                    name: body.display_name || body.name && body.name.given_name,
                    email: body.main_email,
                    mobile_phone: phoneWithLocale,
                    birthdate: birthDate,
                    city,
                    state,
                    legal_bases: [
                      {
                        category: "communications",
                        type:"consent",
                        status: body.accepts_marketing !== false ? 'granted' : 'declined'
                      }
                    ]
                  }
                }
                rdAxios.preparing
                  .then(() => {
                    const { axios } = rdAxios
                    console.log('> Send resource', JSON.stringify(data), ' <<')
                    // https://axios-http.com/ptbr/docs/req_config
                    
                    let url = resource !== 'customers' ? '/platform/events' : '/platform/contacts'
                    return axios.post(url, data, { 
                      maxRedirects: 0,
                      validateStatus
                    })
                  })
                  .then(({ status }) => {
                    console.log(`> ${status} - Created ${resource} - ${resourceId} - ${storeId}`)
                    if (resource === 'orders' || resource === 'carts') {
                      rdAxios.preparing
                        .then(() => {
                          const { axios } = rdAxios
                          if (body && body.financial_status && body.financial_status.current === 'paid') {
                            console.log('send sale type')
                            data = {
                              "event_type": "SALE",
                              "event_family": "CDP",
                              "payload": {
                                "email": body.main_email,
                                "funnel_name": "default",
                                "value": body.amount && body.amount.total
                              }
                            }
                            console.log('sale data', JSON.stringify(data))
                            axios.post('/platform/events?event_type=sale', data, { 
                              maxRedirects: 0,
                              validateStatus
                            })
                          } else {
                            const resourceSub = resource.replace('s', '')
                            const addProp = [`cf_${resourceSub}_product_id`, `CF_${resourceSub.toUpperCase()}_PRODUCT_SKU`]
                            const removeProp = [`cf_${resourceSub}_total_items`, `cf_${resourceSub}_status`, `cf_${resourceSub}_payment_method`, `cf_${resourceSub}_payment_amount`] 
                            const promises = []
                            const isOrder = resource === 'orders'
                            if (items && items.length && data) {
                              removeProp.forEach(prop => delete data['payload'][prop])
                              items.forEach(item => {
                                data['payload'][addProp[0]] = item.product_id
                                data['payload'][addProp[1]] = item.sku
                                data['event_type'] = isOrder ? 'ORDER_PLACED_ITEM' : 'CART_ABANDONED_ITEM'
                                promises.push(axios.post('/platform/events', data, { 
                                  maxRedirects: 0,
                                  validateStatus
                                }))
                              });
                              Promise.all(promises).then((response) => console.log(`>> Created items ${resource} - ${storeId}`, response))
                            }
                          }
                        })
                    }
                  })
                  .catch(error => {
                    if (error.response && error.config) {
                      const err = new Error(`#${storeId} ${resourceId} POST failed`)
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
