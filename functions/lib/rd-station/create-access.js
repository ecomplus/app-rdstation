const Axios = require('./create-axios')
const auth = require('./create-auth')
// typeScope ===  card, if scope card_tokenization
// typeScope === transaction, if scope for transaction

const firestoreColl = 'rd_tokens'

const AxiosOrToken = (resolve, reject, clienId, clientSecret, code, isSandbox, storeId, self) => {

  let documentRef
  if (firestoreColl) {
    documentRef = require('firebase-admin')
      .firestore()
      .doc(`${firestoreColl}/${storeId}`)
  }

  const authenticate = (accessToken, resolve) => {
    if (self) {
      const axios = Axios(accessToken, isSandbox)
      resolve(axios)
    } else {
      resolve(accessToken)
    }
  }

  const handleAuth = (refreshToken, resolve) => {
    console.log('> Rd Auth ', storeId)
    auth(clienId, clientSecret, code, refreshToken, storeId, isSandbox)
      .then((resp) => {
        authenticate(resp.access_token, resolve)
        if (documentRef) {
          documentRef.set({ ...resp, isSandbox }).catch(console.error)
        }
      })
      .catch(reject)
  }

  if (documentRef) {
    documentRef.get()
      .then((documentSnapshot) => {
        const data = documentSnapshot.data() || null
        if (documentSnapshot.exists && data && data.expires_in && new Date(data.expires_in).getTime() <= 23 * 60 * 60 * 1000) {
          authenticate(data.access_token, resolve)
        } else {
          handleAuth(data.refresh_token, resolve)
        }
      })
      .catch(console.error)
  } else {
    handleAuth(resolve)
  }
}

const CreateAxios = (clienId, clientSecret, code, isSandbox, storeId) => {
  return new Promise((resolve, reject) => {
    AxiosOrToken(resolve, reject, clienId, clientSecret, code, isSandbox, storeId, this)
  })
}

const getToken = (clienId, clientSecret, code, isSandbox, storeId) => {
  return new Promise((resolve, reject) => {
    AxiosOrToken(resolve, reject, clienId, clientSecret, code, isSandbox, storeId)
  })
}

module.exports = {
  CreateAxios,
  getToken
}
