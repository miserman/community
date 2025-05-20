library(xml2)

test_that("structure is intact and environment is added to", {
  raw <- page_tutorials()
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  expect_true(xml_length(xml_child(html)) == 1)
  expect_true(xml_length(xml_child(xml_child(html))) == 1)
})

test_that("build environment is added to", {
  tutorial <- list(
    steps = list(
      list(
        description = "Click on the settings button.",
        focus = "#navbar_menu .nav-item:nth-child(3)"
      ),
      list(
        description = "Locate setting A.",
        focus = "setting.a"
      )
    )
  )
  content <- page_tutorials("Use Settings Menu" = tutorial)
  parts <- make_build_environment()
  eval(
    expression(
      page_tutorials(
        "Use Settings Menu" = list(
          steps = list(
            list(
              description = "Click on the settings button.",
              focus = "#navbar_menu .nav-item:nth-child(3)"
            ),
            list(
              description = "Locate setting A.",
              focus = "setting.a"
            )
          )
        )
      )
    ),
    parts
  )
  expect_identical(parts$tutorials[[1]]$steps, tutorial$steps)
})
