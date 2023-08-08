const getAppData = require('./../../lib/store-api/get-app-data')
const updateAppData = require('./../../lib/store-api/update-app-data')

exports.post = ({ appSdk, admin }, req, res) => {
  console.log('>>Webhook RD: POST')
  const { body, query } = req
  let { storeId, code } = query
  storeId = parseInt(storeId, 10)
  console.log('>> Store: ', storeId, ' code: ', code, ' <<')
  if (storeId > 100) {
    res.status(200)
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
