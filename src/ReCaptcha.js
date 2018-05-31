let recaptchaLoaderPromise = null
let recaptchaApi = null

export default {
  name: 'ReCaptcha',
  introduction: 'A Vue.js implementation of Google reCaptcha.',
  token: '<re-captcha dark invisible @verified="signup" :sitekey="<key>" :verifying.sync="recaptcha_verifying">',
  props: {
    dark: {
      type: Boolean,
      default: false,
      note: 'Whether or not to use the dark theme'
    },
    invisible: {
      type: Boolean,
      default: false,
      note: 'Whether or not to use the invisible type'
    },
    sitekey: {
      type: String,
      // This is a development key:
      // https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha-v2-what-should-i-do
      default: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',
      note: 'The site key as per Googles documentation'
    },
    verifying: {
      type: Boolean,
      default: false,
      note: 'This should be synced to display a loading indicator in case of the invisible type'
    },
    verified: {
      type: Boolean,
      default: false,
      note: 'This could be synced to possibly track verification status'
    }
  },
  data () {
    return {
      widget: null,
      token: null
    }
  },
  created () {
    // Start with the defaults
    this.$emit('update:verifying', false)
    this.$emit('update:verified', false)
    this.$emit('update:token', null)

    // Load the api
    this.getRecaptchaApi().then(api => {
      // and fire up a widget, an id will be returned, which we can use later
      this.widget = api.render(this.$refs.recaptchaelement, {
        'sitekey': this.sitekey,
        'theme': this.dark ? 'dark' : 'light',
        'size': this.invisible ? 'invisible' : null,
        'callback': this.verifyCallback,
        'expired-callback': this.expiredCallback,
        'data-error-callback': this.errorCallback
      })

      // The invisible reCaptcha adds a "badge" to the page,
      // fixed to bottom right by default, that reminds me:
      // TODO: pass along extra settings to position badge
      // In case the badge is a descendant of another fixed
      // element, things will start to act up. We'll add it to the body
      if (this.invisible) {
        setTimeout(function () {
          document.getElementsByTagName('body')[0].appendChild(
            document.getElementsByClassName('grecaptcha-badge')[0]
          )
        })
      }
    })
  },
  methods: {
    /**
     * This is called upon validation from the reCaptcha widget
     * @param token The token to be checked on a server to validate this verification
     */
    verifyCallback (token) {
      this.token = token
      this.$emit('update:verifying', false)
      this.$emit('update:verified', true)
      this.$emit('update:token', token)

      this.$emit('verified', token)
    },
    /**
     * A token will expire after a while, in which case the user needs to re-verify
     */
    expiredCallback () {
      this.$emit('update:verified', false)
      this.$emit('update:token', null)
      this.token = null

      this.$emit('expired')
    },
    /**
     * Errors happen, mostly when a connection is lost (whilst running the verification)
     */
    errorCallback () {
      this.$emit('update:verified', false)
      this.$emit('update:token', null)
      this.token = null

      this.$emit('error')
    },
    /**
     * When the surrounding div is clicked, this is triggered
     * this is when we start the verification
     */
    onClick () {
      this.$emit('update:verifying', true)
      this.$emit('verifying')

      // In case we have a token already, we should use that as verification
      if (this.token) {
        this.verifyCallback(this.token)
      } else {
        this.getRecaptchaApi().then(api => {
          api.execute(this.widget)
        })
      }
    },
    /**
     * We have some cleanup to do when this element has been removed
     */
    destroy () {
      this.$emit('update:verified', false)
      this.$emit('update:token', null)
      this.token = null

      // Remove the reCaptcha badge
      let badgeElements = document.getElementsByClassName('grecaptcha-badge')
      for (let i in badgeElements) {
        if (badgeElements.hasOwnProperty(i)) {
          badgeElements[i].parentNode.removeChild(badgeElements[i])
        }
      }

      // An open modal or lingering code should be removed
      this.getRecaptchaApi().then(api => {
        this.$nextTick(_ => {
          api.reset(this.widget)
        })
      })
    },
    /**
     * Load the api from the google servers
     * When tha api is already available, we'll just resolve that
     */
    getRecaptchaApi () {
      if (recaptchaLoaderPromise === null) {
        recaptchaLoaderPromise = new Promise((resolve, reject) => {
          // Resolve either via de loader script, or in case the api is already available
          function doResolve () {
            window.grecaptcha.ready(function () {
              // Store the api in our local variable, and resolve
              recaptchaApi = window.grecaptcha
              resolve(recaptchaApi)
            })
          }

          // It's highly possible the api has already loaded and available in window.grecaptcha
          if (window.grecaptcha) {
            doResolve()
          } else {
            // Create a script tag which we'll add to the head of the page
            let script = document.createElement('script')
            script.onload = doResolve
            script.defer = true
            script.async = true
            script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'

            // Now load the reCaptcha API
            document.head.appendChild(script)
          }
        })
      }

      return recaptchaLoaderPromise
    }
  },
  /**
   * This is called when an element is removed from the page
   */
  beforeDestroy () {
    this.destroy()
  },
  render (h) {
    // We'll create a wrapping div with the div used for the reCaptcha
    // Everything in between the component tags (<re-captcha>) will be rendered below
    // <div>
    //   <div></div>
    //   <<contents>>
    // </div>
    return h('div', {
      on: {
        click: this.onClick
      }
    }, [
      h('div', {
        ref: 'recaptchaelement'
      }),
      this.$slots.default
    ])
  }
}
