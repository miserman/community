# add structural page components
page_navbar(title = "Name of Site", About = list("Minimal data site."))

# specify inputs with IDs
input_select("Variables", "variables", id = "selected_variable")

# specify outputs using those inputs
output_info("variable.short_name", variable = "selected_variable")
output_text("The {selected_variable} variable is selected.")
