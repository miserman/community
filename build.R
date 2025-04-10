# rebuild
styler::style_pkg(filetype = c("R", "Rmd"))
spelling::spell_check_package()
devtools::document()
pkgdown::build_site(lazy = TRUE)

# update site assets

## rebuild minified files
system2("npm", "run build")

## rebuild stable scripts (if dev should be stable)
if (FALSE) system2("npm", "run build-stable")

## update cache script information
cache_scripts <- list(
  data_handler = list(
    dev = list(
      source = "https://miserman.github.io/community/dist/js/data_handler.min.js",
      location = "docs",
      md5 = tools::md5sum("docs/dist/js/data_handler.min.js")[[1]]
    ),
    stable = list(
      source = "https://miserman.github.io/community/dist/js/data_handler.v2.min.js",
      location = "docs",
      md5 = tools::md5sum("docs/dist/js/data_handler.v2.min.js")[[1]]
    )
  )
)
save(cache_scripts, file = "R/sysdata.rda")

# check
devtools::check()

# generate coverage reports
system2("npm", "test")
covr::report(file = "docs/coverage/package.html", browse = FALSE)

# increment development version
description <- readLines("DESCRIPTION")
description[3] <- paste0(
  sub("\\d+$", "", description[3]),
  as.numeric(sub("^.*\\.", "", description[3])) + 1
)
writeLines(description, "DESCRIPTION")
