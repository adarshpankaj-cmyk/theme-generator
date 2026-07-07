Rails.application.routes.draw do
  # Health check for load balancers / uptime monitors.
  get "up" => "rails/health#show", as: :rails_health_check

  # API surface (F6). See backend/SPEC.md §8.
  namespace :api do
    resources :themes, only: %i[create show] do
      member do
        post :generate
        post :regenerate
        patch :blend
        get :download
        get :preview, to: "previews#preview"
        post :publish, to: "publish#create"
      end
    end
  end
end
