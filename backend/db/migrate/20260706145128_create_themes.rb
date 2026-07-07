class CreateThemes < ActiveRecord::Migration[7.2]
  def change
    create_table :themes do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.text :prompt
      t.string :status, null: false, default: "draft"
      t.decimal :artwork_opacity, precision: 4, scale: 2, null: false, default: 0.35
      t.string :tint_hex
      t.jsonb :blend_overrides, null: false, default: {}
      t.text :error_message

      t.timestamps
    end
    add_index :themes, :slug, unique: true
  end
end
