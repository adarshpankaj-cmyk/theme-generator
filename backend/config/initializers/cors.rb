# Be sure to restart your server when you modify this file.
#
# Allow the React frontend (Vercel) to call this API cross-origin.
# Set FRONTEND_ORIGIN in production; defaults to "*" for local dev.
# Read more: https://github.com/cyu/rack-cors

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("FRONTEND_ORIGIN", "*")

    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: ["Content-Disposition"]
  end
end
